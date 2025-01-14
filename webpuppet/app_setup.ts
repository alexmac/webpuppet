import { randomBytes } from "crypto";
import Express from "express";
import { Browser, HTTPRequest } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export const app = Express();

app.use(Express.json());
app.use((err, req: Express.Request, res: Express.Response, next) => {
  console.error(err.stack); // Log the error for debugging
  res.status(500).send("Internal Server Error");
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

export var session_requests = {};

export function generateRandomString(length) {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

var puppeteerNode: Browser;

export async function getPupetterNode() {
  if (puppeteerNode == null) {
    puppeteerNode = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/chromium",
      args: [
        "--disable-gpu",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
      ],
    });
  }

  return puppeteerNode;
}

export function getDict(obj, key) {
  if (!obj.hasOwnProperty(key)) {
    obj[key] = {
      request_id: 0,
      reqs: [],
    };
  }
  return obj[key];
}

function ignoreRequest(u: string) {
  if (
    u.includes("addthis.com") ||
    u.includes("adnxs.com") ||
    u.includes("ads.linkedin.com") ||
    u.includes("affiliatefuture.com") ||
    u.includes("agkn.com") ||
    u.includes("amplitude.com") ||
    u.includes("api.segment.io") ||
    u.includes("bidswitch.net") ||
    u.includes("casalemedia.com") ||
    u.includes("clarity.ms") ||
    u.includes("cookiebot.com") ||
    u.includes("demdex.com") ||
    u.includes("demdex.net") ||
    u.includes("doubleclick.net") ||
    u.includes("eyeota.net") ||
    u.includes("facebook.com") ||
    u.includes("facebook.net") ||
    u.includes("media.net") ||
    u.includes("google-analytics.com") ||
    u.includes("google.com") ||
    u.includes("googletagmanager.com") ||
    u.includes("gstatic.com") ||
    u.includes("hotjar.com") ||
    u.includes("krxd.net") ||
    u.includes("liadm.com") ||
    u.includes("licdn.com") ||
    u.includes("openx.net") ||
    u.includes("pippio.com") ||
    u.includes("pubmatic.com") ||
    u.includes("quantcount.com") ||
    u.includes("quantserve.com") ||
    u.includes("rezync.com") ||
    u.includes("rlcdn.com") ||
    u.includes("rfihub.com") ||
    u.includes("rfihub.net") ||
    u.includes("rtactivate.com") ||
    u.includes("sentry.io") ||
    u.includes("serving-sys.com") ||
    u.includes("smct.co") ||
    u.includes("soundcloud.com") ||
    u.includes("tiktok.com") ||
    u.includes("tremorhub.com") ||
    u.includes("youtube.com") ||
    u.includes("data:image")
  ) {
    return true;
  }

  return false;
}

export async function handleRequestFinished(
  interceptedRequest: HTTPRequest,
  sessionID: string
) {
  if (ignoreRequest(interceptedRequest.url())) {
    return;
  }
  // console.log(`> interceptedRequest ${interceptedRequest.url()}`)

  var d = getDict(session_requests, sessionID);
  var info = {
    url: interceptedRequest.url(),
    headers: interceptedRequest.headers(),
    method: interceptedRequest.method(),
    postData: interceptedRequest.postData(),
    redirectChain: interceptedRequest.redirectChain(),
    resourceType: interceptedRequest.resourceType(),
  };
  const resp = interceptedRequest.response();
  if (resp !== null) {
    var body = "";
    try {
      body = (await resp.buffer()).toString();
    } catch {
      //do nothing
    }
    info["resp"] = {
      status: resp.status(),
      headers: resp.headers(),
      body: body,
    };
  }
  d.reqs.push(info);
}

app.get("/health", async (req: Express.Request, res: Express.Response) => {
  res.send({});
});
