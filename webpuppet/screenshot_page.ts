import * as fs from "fs";
import { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

puppeteer.use(StealthPlugin());

async function captureScreenshots(page: Page, url: string, out: string) {
  await page.goto(url);
  await page.waitForNetworkIdle();

  await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="position-sticky"]');
    elements.forEach((element) => element.remove());
  });

  // Get the dimensions of the page
  const bodyHandle = await page.$("body");
  if (!bodyHandle) {
    process.exit(-1);
  }
  const boundingBox = await bodyHandle.boundingBox();
  if (!boundingBox) {
    process.exit(-1);
  }
  const totalHeight = boundingBox.height;
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const overlap = viewportHeight * (3 / 4);
  let screenshots: Array<string> = [];
  let position = 0;

  // Scroll and capture screenshots
  while (position < totalHeight) {
    const path = `${out}/screenshot-${screenshots.length + 1}.png`;
    await page.screenshot({ path: path });
    console.log(path);
    screenshots.push(path);
    position += overlap;

    // Scroll the page by half the viewport height
    await page.evaluate((scrollBy) => {
      window.scrollBy(0, scrollBy);
    }, overlap);

    // Check if we're near the end of the page
    const newPosition = await page.evaluate(() => window.scrollY);
    if (newPosition + viewportHeight >= totalHeight) {
      break;
    }
  }

  // Capture the final screenshot
  const path = `${out}/screenshot-${screenshots.length + 1}.png`;
  await page.screenshot({ path: path });
  console.log(path);
  screenshots.push(path);

  return screenshots;
}

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option("url", {
      type: "string",
      describe: "The URL to process",
      demandOption: true,
    })
    .option("out", {
      type: "string",
      describe: "The output dir path",
      demandOption: true,
    }).argv;

  const outDir = argv.out;
  if (!fs.existsSync(argv.out)) {
    fs.mkdirSync(argv.out, { recursive: true });
  }

  const startUp = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: [
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--no-zygote",
    ],
  });
  const page = await startUp.newPage();

  await page.setViewport({
    width: 1024,
    height: 1024,
    deviceScaleFactor: 1,
  });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  );

  await captureScreenshots(page, argv.url, argv.out);

  await page.close();
  process.exit(0);
})();
