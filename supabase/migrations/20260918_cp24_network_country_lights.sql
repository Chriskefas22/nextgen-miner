create or replace function public.nextgen_home_network_lights()
returns jsonb
language plpgsql
security definer
stable
set search_path to ''
as $function$
declare
  result jsonb;
begin
  /*
   * Decorative network visualization only.
   * Coordinates are country-level; exact user locations are never returned.
   * One anonymous light is emitted per registered user that has a country code.
   */
  with base as (
    select
      u.id,
      upper(coalesce(u.raw_user_meta_data->>'country_code','')) as cc,
      row_number() over (
        partition by upper(coalesce(u.raw_user_meta_data->>'country_code',''))
        order by u.created_at, u.id
      ) as country_index
    from auth.users u
    where coalesce(u.raw_user_meta_data->>'country_code','') <> ''
  ),
  mapped as (
    select
      b.id,
      b.cc,
      b.country_index,
      case b.cc
        when 'ID' then -0.7893 when 'SG' then 1.3521 when 'MY' then 4.2105
        when 'TH' then 15.8700 when 'PH' then 12.8797 when 'VN' then 14.0583
        when 'CN' then 35.8617 when 'JP' then 36.2048 when 'KR' then 35.9078
        when 'IN' then 20.5937 when 'PK' then 30.3753 when 'BD' then 23.6850
        when 'LK' then 7.8731 when 'AE' then 24.4539 when 'SA' then 23.8859
        when 'TR' then 38.9637 when 'IL' then 31.0461 when 'RU' then 61.5240
        when 'GB' then 55.3781 when 'IE' then 53.1424 when 'FR' then 46.2276
        when 'DE' then 51.1657 when 'NL' then 52.1326 when 'BE' then 50.5039
        when 'ES' then 40.4637 when 'PT' then 39.3999 when 'IT' then 41.8719
        when 'CH' then 46.8182 when 'AT' then 47.5162 when 'SE' then 60.1282
        when 'NO' then 60.4720 when 'DK' then 56.2639 when 'FI' then 61.9241
        when 'PL' then 51.9194 when 'UA' then 48.3794 when 'US' then 37.0902
        when 'CA' then 56.1304 when 'MX' then 23.6345 when 'BR' then -14.2350
        when 'AR' then -38.4161 when 'CL' then -35.6751 when 'CO' then 4.5709
        when 'PE' then -9.1900 when 'VE' then 6.4238 when 'ZA' then -30.5595
        when 'NG' then 9.0820 when 'KE' then -0.0236 when 'GH' then 7.9465
        when 'EG' then 26.8206 when 'MA' then 31.7917 when 'TZ' then -6.3690
        when 'AU' then -25.2744 when 'NZ' then -40.9006 else null
      end as base_lat,
      case b.cc
        when 'ID' then 113.9213 when 'SG' then 103.8198 when 'MY' then 101.9758
        when 'TH' then 100.9925 when 'PH' then 121.7740 when 'VN' then 108.2772
        when 'CN' then 104.1954 when 'JP' then 138.2529 when 'KR' then 127.7669
        when 'IN' then 78.9629 when 'PK' then 69.3451 when 'BD' then 90.3563
        when 'LK' then 80.7718 when 'AE' then 54.3773 when 'SA' then 45.0792
        when 'TR' then 35.2433 when 'IL' then 34.8516 when 'RU' then 105.3188
        when 'GB' then -3.4360 when 'IE' then -7.6921 when 'FR' then 2.2137
        when 'DE' then 10.4515 when 'NL' then 5.2913 when 'BE' then 4.4699
        when 'ES' then -3.7492 when 'PT' then -8.2245 when 'IT' then 12.5674
        when 'CH' then 8.2275 when 'AT' then 14.5501 when 'SE' then 18.6435
        when 'NO' then 8.4689 when 'DK' then 9.5018 when 'FI' then 25.7482
        when 'PL' then 19.1451 when 'UA' then 31.1656 when 'US' then -95.7129
        when 'CA' then -106.3468 when 'MX' then -102.5528 when 'BR' then -51.9253
        when 'AR' then -63.6167 when 'CL' then -71.5430 when 'CO' then -74.2973
        when 'PE' then -75.0152 when 'VE' then -66.5897 when 'ZA' then 22.9375
        when 'NG' then 8.6753 when 'KE' then 37.9062 when 'GH' then -1.0232
        when 'EG' then 30.8025 when 'MA' then -7.0926 when 'TZ' then 34.8888
        when 'AU' then 133.7751 when 'NZ' then 174.8860 else null
      end as base_lon
    from base b
  ),
  lights as (
    select
      b.id,
      jsonb_build_object(
        'lat',
          round((
            base_lat +
            sin(country_index * 2.39996323) *
              least(2.2, 0.28 + sqrt(country_index::numeric) * 0.34)
          )::numeric, 5),
        'lon',
          round((
            base_lon +
            cos(country_index * 2.39996323) *
              least(2.2, 0.34 + sqrt(country_index::numeric) * 0.42)
          )::numeric, 5),
        'country_code', cc,
        'intensity',
          round((0.68 + greatest(0.0, least(0.22, country_index * 0.01)))::numeric, 3)
      ) as light
    from mapped b
    where base_lat is not null and base_lon is not null
  )
  select coalesce(jsonb_agg(light order by id), '[]'::jsonb)
  into result
  from lights;

  return result;
end;
$function$;

revoke all on function public.nextgen_home_network_lights() from public,anon;
grant execute on function public.nextgen_home_network_lights() to authenticated;
