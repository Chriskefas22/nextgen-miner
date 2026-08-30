export const number=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
export const diamond=(value:number)=>`💎 ${number(value)}`;
export const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(value);
export const hash=(value:number)=>`${number(value)} H/s`;
export const compact=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
