# GuiTeK's Solidity Contracts

## Tests

Install `ganache-cli`:
```bash
npm install ganache-cli@latest --global
```

Run Ganache (`--account_keys_path` is important to export private keys so the tests can know them and use them to sign data):
```bash
ganache-cli --port 8545 --host 127.0.0.1 --account_keys_path ${SOLIDITY_CONTRACTS_REPOSITORY_ROOT}/test/ganache_account_keys.json
```

And finally run the tests:
```bash
truffle test test/equity.js
truffle test test/test_lazy_minting_erc721.js
truffle test test/test_opensea_erc721.js
```
