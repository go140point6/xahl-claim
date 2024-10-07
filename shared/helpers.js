// claim reward functions .............................................
function get_exponent(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return 0n;
    return ((xfl >> 54n) & 0xFFn) - 97n;
  }
  
  function get_mantissa(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return 0n;
    return xfl - ((xfl >> 54n) << 54n);
  }
  
  function is_negative(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return false;
    return ((xfl >> 62n) & 1n) == 0n;
  }
  
  function to_string(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return "<zero>";
    return (is_negative(xfl) ? "-" : "+") +
      get_mantissa(xfl).toString() + "E" + get_exponent(xfl).toString();
  }
  
  function xflToFloat(xfl) {
    return parseFloat(to_string(xfl));
  }
  
  function changeEndianness(str){
    const result = [];
    let len = str.length - 2;
    while (len >= 0) {
      result.push(str.substr(len, 2));
      len -= 2;
    }
    return result.join('');
  }
  
  function hookStateXLFtoBigNumber(stateData) {
    const data = changeEndianness(stateData);
    const bi = BigInt('0x' + data);
    return xflToFloat(bi);
  }
  
  function calcrewardRateHuman(rewardRate) {
    if (!rewardRate) return "0 %";
    if (rewardRate < 0 || rewardRate > 1) return "Invalid rate";
    return (Math.round((((1 + rewardRate) ** 12) - 1) * 10000) / 100) + " %";
  }
  
  function calcrewardDelayHuman(rewardDelay) {
    if (rewardDelay / 3600 < 1) return Math.ceil(rewardDelay / 60) + " mins";
    if (rewardDelay / (3600 * 24) < 1) return Math.ceil(rewardDelay / 3600) + " hours";
    return Math.ceil(rewardDelay / (3600 * 24)) + ' days';
  }

module.exports = {
    get_exponent,
    get_mantissa,
    is_negative,
    to_string,
    xflToFloat,
    changeEndianness,
    hookStateXLFtoBigNumber,
    calcrewardRateHuman,
    calcrewardDelayHuman
}
