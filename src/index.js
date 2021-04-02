const Web3 = require('web3')
const fs = require('fs')
const BigNumber = require('bignumber.js')
const axios = require('axios')
const Tx = require('ethereumjs-tx').Transaction

const sleep = (time) => {
  return new Promise(resolve => setTimeout(resolve, time))
}

const keys = [

]

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/e627df92b3124ef4ac3a8b7b86664e1a'))

const abi = fs.readFileSync("src/claim.json", "utf-8")
const contract = new web3.eth.Contract(JSON.parse(abi), '0xA39d1e9CBecdb17901bFa87a5B306D67f15A2391')

keys.map(async (key, index) => {
  // 解析账户地址
  const { address } = web3.eth.accounts.privateKeyToAccount(key)

  // 循环请求接口，直到接口返回签名和 id
  let pause = true
  let params
  while (pause) {
    try {
      const result = await axios.get(`https://cu3pxr9ydi.execute-api.us-east-1.amazonaws.com/prod/distributor/${address}`)
      console.log(result.data)
      if (result.data[0].id !== '') {
        pause = false
        params = result.data[0]
      }
    } catch (e) {
      console.log('retry', index)
      console.log(e)
    }
    await sleep(20000)
  }
  
  /* 这三行备用，防止接口传过来是普通字符串需要自己手动转 byte32 */
  // params.id = web3.utils.utf8ToHex(id)
  // params.r = web3.utils.utf8ToHex(r)
  // params.s = web3.utils.utf8ToHex(s)

  // 构造合约调用函数
  const txData = contract.methods.claim(
    params.id || '0xA39d1e9CBecdb17901bFa87a5B306D67f15A2391',
    params.account,
    new BigNumber(params.amount),
    params.v || 1,
    params.r || '0xA39d1e9CBecdb17901bFa87a5B306D67f15A2391',
    params.s || '0xA39d1e9CBecdb17901bFa87a5B306D67f15A2391',
  ).encodeABI()

  // 获取账号交易随机数
  web3.eth.getTransactionCount(address, (err, txCount) => {
    // 交易签名
    const txObject = {
      from: address,
      to: '0xA39d1e9CBecdb17901bFa87a5B306D67f15A2391',
      gasPrice: web3.utils.toHex(web3.utils.toWei('300', 'gwei')),
      gas: web3.utils.toHex(145636),
      data: txData,
      nonce: web3.utils.toHex(txCount),
    }
    const tx = new Tx(txObject)
    tx.sign(Buffer.from(key, 'hex'))
    const serializedTx = tx.serialize()
    const raw = '0x' + serializedTx.toString('hex')

    // 广播交易
    web3.eth.sendSignedTransaction(raw, (err, txHash) => {
      console.log('txHash:', txHash)
      console.log(err)
    })
  })
})