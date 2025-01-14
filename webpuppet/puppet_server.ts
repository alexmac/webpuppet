import { app } from "./app_setup.ts";

import * as puppet from "./puppet.ts";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppet;

puppeteer.use(StealthPlugin());

const port: number = 7777;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
