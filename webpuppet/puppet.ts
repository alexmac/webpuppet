import { spawn } from "child_process";
import Express from "express";
import { fileSync } from "tmp";

import { HTTPRequest, MouseButton, Page, ScreenRecorder } from "puppeteer";
import {
  app,
  generateRandomString,
  getDict,
  getPupetterNode,
  handleRequestFinished,
  session_requests,
} from "./app_setup.ts";

var sessions = {};

var session_screencasts = {};

function getPageForSession(sessionID: string) {
  return sessions[sessionID] as Page;
}

async function handlePageAction(
  sessionID: string,
  action: (page: Page) => Promise<any>,
  errorMessage: string
): Promise<any> {
  const page = getPageForSession(sessionID);
  try {
    const result = await action(page);
    return result;
  } catch (e) {
    console.log(`> ${errorMessage} failed ${e}`);
    throw {
      status: 400,
      error: `${e}`,
    };
  }
}

async function handleRoute(
  req: Express.Request,
  res: Express.Response,
  action: () => Promise<any>
) {
  try {
    const result = await action();
    res.send(result || {});
  } catch (error: any) {
    res.status(error.status || 500).send({
      error: error.error || "Internal server error",
    });
  }
}

app.post(
  "/session/create",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = generateRandomString(16);
    console.log(`Launching session id ${sessionID}`);

    const pn = await getPupetterNode();
    const bc = await pn.createBrowserContext();

    const page = await bc.newPage();
    page.setDefaultTimeout(3000);
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", async (interceptedRequest: HTTPRequest) => {
      // console.log(`> request ${interceptedRequest.url()}`)
      interceptedRequest.continue();
    });
    page.on("requestfinished", async (interceptedRequest: HTTPRequest) => {
      // console.log(`> requestfinished ${interceptedRequest.url()}`)

      await handleRequestFinished(interceptedRequest, sessionID);
    });

    sessions[sessionID] = page;
    console.log(`> sessionID ${sessionID} created`);

    res.send(sessionID);
  }
);

app.delete(
  "/session/:sessionID([a-fA-F0-9]{16})",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    console.log(`Deleting session id ${sessionID}`);

    const page = getPageForSession(sessionID);
    await page.browserContext().close();

    delete sessions[sessionID];

    res.send({});
  }
);

app.get(
  "/session/:sessionID([a-fA-F0-9]{16})/requests",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;

    var d = getDict(session_requests, sessionID);

    console.log(`> sessionID ${sessionID} requests: ${d.reqs.length}`);
    res.send(d);
  }
);

app.delete(
  "/session/:sessionID([a-fA-F0-9]{16})/requests",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    var d = getDict(session_requests, sessionID);
    console.log(`> sessionID ${sessionID} del requests: ${d.reqs.length}`);
    delete session_requests[sessionID];
    res.send();
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/goto",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { url } = req.body;
    console.log(`> sessionID ${sessionID} goto: ${url}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await Promise.all([page.waitForNavigation(), page.goto(url)]);
        },
        "goto"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/screenshot",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    const url = req.body.url;
    const page = getPageForSession(sessionID);
    const fullPage = req.body.full_page || false;

    const tmpobj = fileSync();

    console.log(`> sessionID ${sessionID} screenshot`);
    await page.screenshot({
      path: tmpobj.name,
      type: "jpeg",
      fullPage: fullPage,
      quality: 95,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`> sessionID ${sessionID} screenshot> ${tmpobj.name}`);

    res.sendFile(tmpobj.name, (err) => {
      if (err) {
        console.log(err);
        // res.status(500).send("Error occurred while sending the file.");
      } else {
        console.log("no error");
      }
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/screencast/start",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    const url = req.body.url;
    const page = getPageForSession(sessionID);

    console.log(`> sessionID ${sessionID} screencast start`);

    const transcode = false;
    let recorder: ScreenRecorder;
    let path: string;

    if (transcode) {
      path = `/tmp/${sessionID}.fifo.webm`;
      const fifo = spawn("mkfifo", [path]);
      recorder = await page.screencast({ path: `/tmp/${sessionID}.fifo.webm` });

      setTimeout(() => {
        console.log("starting transcode");
        // const fifo = spawn('mkfifo', [`/tmp/${sessionID}.fifo`]);
        // const socat = spawn('socat', ['-u', `FILE:${sessionID}.webm,nonblock`, `PIPE:/tmp/${sessionID}.fifo`]);

        const rtmp_transcode = spawn("ffmpeg", [
          "-re",
          "-i",
          path,
          "-vf",
          "scale=320:240",
          "-vcodec",
          "libx264",
          "-vprofile",
          "high444",
          "-g",
          "30",
          "-acodec",
          "aac",
          "-strict",
          "-2",
          "-f",
          "flv",
          `rtmp://localhost/webpuppet/${sessionID}`,
        ]);
        rtmp_transcode.on("close", (code) => {
          console.log(`ffmpeg process exited with code ${code}`);
        });
        if (true) {
          rtmp_transcode.stdout.on("data", (data) => {
            console.error(`stderr: ${data}`);
          });

          rtmp_transcode.stderr.on("data", (data) => {
            console.error(`stderr: ${data}`);
          });
        }
        session_screencasts[sessionID]["rtmp_transcode"] = rtmp_transcode;
      }, 1000);
    } else {
      path = `out/recording.webm`;
      recorder = await page.screencast({ path: `out/recording.webm` });
    }

    session_screencasts[sessionID] = {
      recorder: recorder,
      path: path,
      rtmp_transcode: null,
    };

    res.send({
      url: `http://localhost:9000/hls/${sessionID}/index.m3u8`,
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/screencast/stop",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    const url = req.body.url;
    const page = getPageForSession(sessionID);

    console.log(`> sessionID ${sessionID} screencast stop`);
    const recorder = session_screencasts[sessionID]["recorder"];
    const path = session_screencasts[sessionID]["path"];
    await recorder.stop();

    const transcode = session_screencasts[sessionID]["rtmp_transcode"];
    if (transcode) {
      transcode.kill();
      spawn("rm", [path]);
    }

    res.send({});
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/content",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    const page = getPageForSession(sessionID);
    const c = await page.content();
    console.log(`> sessionID ${sessionID} content`);
    res.send(c);
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/tap",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { selector } = req.body;
    console.log(`> sessionID ${sessionID} tap ${selector}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await Promise.all([page.waitForNavigation(), page.tap(selector)]);
        },
        "tap"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/keyboard/type",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { text } = req.body;
    console.log(`> sessionID ${sessionID} keyboard type ${text}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.keyboard.type(text);
        },
        "keyboard type"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/mouse/move",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { x, y } = req.body;
    console.log(`> sessionID ${sessionID} mouse move ${x} ${y}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await Promise.all([page.waitForNavigation(), page.mouse.move(x, y)]);
        },
        "mouse move"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/mouse/click/left",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    console.log(`> sessionID ${sessionID} mouse left click`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.mouse.down({ button: MouseButton.Left });
          await page.mouse.up({ button: MouseButton.Left });
        },
        "mouse left click"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/type",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { selector, text } = req.body;
    console.log(`> sessionID ${sessionID} type ${selector} ${text}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await Promise.all([page.type(selector, text)]);
        },
        "type"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/select",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { selector, selection } = req.body;
    console.log(`> sessionID ${sessionID} select ${selector} ${selection}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.select(selector, selection);
        },
        "select"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/keyboard/down",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { keyname } = req.body;
    console.log(`> sessionID ${sessionID} keyboard down ${keyname}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.keyboard.down(keyname);
        },
        "keyboard down"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/keyboard/press",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { keyname } = req.body;
    console.log(`> sessionID ${sessionID} keyboard press ${keyname}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.keyboard.press(keyname);
        },
        "keyboard press"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/keyboard/up",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { keyname } = req.body;
    console.log(`> sessionID ${sessionID} keyboard up ${keyname}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.keyboard.up(keyname);
        },
        "keyboard up"
      );
    });
  }
);

app.put(
  "/session/:sessionID([a-fA-F0-9]{16})/focus",
  async (req: Express.Request, res: Express.Response) => {
    const { sessionID } = req.params;
    const { selector } = req.body;
    console.log(`> sessionID ${sessionID} focus ${selector}`);

    await handleRoute(req, res, async () => {
      await handlePageAction(
        sessionID,
        async (page) => {
          await page.focus(selector);
        },
        "focus"
      );
    });
  }
);

app.get(
  "/session/:sessionID([a-fA-F0-9]{16})/mainFrame/url",
  async (req: Express.Request, res: Express.Response) => {
    const sessionID = req.params.sessionID;
    const page = getPageForSession(sessionID);
    console.log(`> sessionID ${sessionID} url:${page.mainFrame().url()}`);
    res.send(page.mainFrame().url());
  }
);
