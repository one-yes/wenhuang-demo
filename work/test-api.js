async function main() {
  const payload = {
    bookName: "测试长文本",
    text: `《我是卷王穿越者的废物对照组》
作者：若星若辰
谢无炽把药递过去，时书偏开脸不接。
“不要。”
“宝宝喂我。”
时书耳尖红了，转移话题：“点心，吃一块？”`,
    thrill: "主角谢无炽的说话方式",
    avoid: "",
    inputMode: "long"
  };
  const response = await fetch("http://127.0.0.1:5177/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  console.log(response.status);
  console.log(text.slice(0, 1200));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
