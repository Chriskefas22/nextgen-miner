-- NextGen Miner: BNB deposit destination
-- User-supplied address. QR file: assets/deposit/qr/bnb.png
update public.ng_deposit_destinations
set asset='BNB',
    network='BNB Smart Chain',
    provider='Manual',
    destination='0x9d2679074C80c2F94E6FB1DFaAA08A538458b82A',
    label='Binance Coin (BNB)',
    min_deposit=0.000001,
    confirmations_required=6,
    network_fee=0,
    warning_title='BNB only',
    warning_message='Send only BNB on the BNB chain. Sending the wrong coin or using a different network will result in a permanent loss of funds. We are not responsible for lost funds.',
    first_deposit_note='First-time deposits can take up to 30 minutes depending on network congestion. We do not support deposits from smart contracts — recovery fees apply.',
    qr_code_path='assets/deposit/qr/bnb.png',
    active=true,
    is_active=true
where id=1;
