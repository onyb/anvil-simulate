const express = require('express')
const axios = require('axios')
const bodyParser = require('body-parser')
const BigNumber = require('bignumber.js')

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
const port = 3000

const tokenRegistry = [
  {
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    decimals: 6
  },
  {
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    decimals: 6
  },
  {
    contractAddress: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
    symbol: 'BAT',
    decimals: 18
  }
]

async function cast (method, params) {
  const response = await axios.post('http://localhost:8545', {
    id: 1,
    jsonrpc: '2.0',
    method,
    params
  })

  console.log(`=====> Request: ${method}`)
  console.log(params)
  console.log('<===== Response: ', response.data)
  return response.data
}

app.post('/', async (req, res) => {
  const { from, to, value, data } = req.body

  await cast('anvil_reset', [
    {
      forking: {
        jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      }
    }
  ])

  const balanceRegistryBefore = []
  for (const token of tokenRegistry) {
    const { result } = await cast('eth_call', [
      {
        data: '0x70a08231' + '000000000000000000000000' + from.replace('0x', ''),
        to: token.contractAddress
      },
      'latest'
    ])

    balanceRegistryBefore.push({ ...token, before: result })
  }

  await cast('anvil_setNextBlockBaseFeePerGas', ['0x0'])
  await cast('anvil_impersonateAccount', [from])
  await cast('eth_sendTransaction', [
    {
      from,
      to,
      value,
      data,
      gasPrice: '0x0'
    }
  ])

  const balanceRegistryAfter = []
  for (const token of balanceRegistryBefore) {
    const { result } = await cast('eth_call', [
      {
        data: '0x70a08231' + '000000000000000000000000' + from.replace('0x', ''),
        to: token.contractAddress
      },
      'latest'
    ])

    balanceRegistryAfter.push({ ...token, after: result })
  }

  const balanceDiff = balanceRegistryAfter
    .map(token => ({
      symbol: token.symbol,
      diff: new BigNumber(token.after)
        .minus(token.before)
        .div(10 ** token.decimals)
        .toFixed()
    }))
    .concat([
      {
        symbol: 'ETH',
        diff: new BigNumber(value)
          .negated()
          .div(10 ** 18)
          .toFixed()
      }
    ])

  res.send(balanceDiff.filter(each => each.diff !== '0'))
})

app.listen(port, () => {
  console.log(`Anvil simulator listening on port ${port}`)
})
