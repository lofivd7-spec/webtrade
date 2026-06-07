const holdingAmount = 1;
const nftSellWholeMax = holdingAmount <= 0 ? 0 : Math.floor(holdingAmount + 1e-9);
console.log("holdingAmount:", holdingAmount);
console.log("nftSellWholeMax:", nftSellWholeMax);

const holdingAmount2 = "1.000000";
const nftSellWholeMax2 = holdingAmount2 <= 0 ? 0 : Math.floor(holdingAmount2 + 1e-9);
console.log("holdingAmount2:", holdingAmount2);
console.log("nftSellWholeMax2:", nftSellWholeMax2);
