export type MiningAccrualResult = {
asset?: string
accrued_crypto?: number
accrued_usd?: number
elapsed_seconds?: number
hashrate?: number
reward_rate?: number
[key: string]: unknown
}

export async function accrueMining(
asset = 'USDT',
): Promise<MiningAccrualResult> {
const response = await fetch('/api/mining/accrue', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ asset }),
cache: 'no-store',
})

const data = await response.json().catch(() => ({}))

if (!response.ok) {
throw new Error(
typeof data?.error === 'string'
? data.error
: 'Unable to accrue mining reward',
)
}

return data as MiningAccrualResult
}
