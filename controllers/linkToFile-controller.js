const { fetchData } = require("../libs/fetchData");
const { getObjectId } = require("../libs/id");
const { response } = require("../response");
const { RunQuery } = require("../services");
const fetch = require("node-fetch");
const fs = require("fs");
const { getLastDate } = require("../global/getStartEndDate");

async function insertYoutubeLink(req, res, cancellationToken) {
  try {
    let { youtube_link } = req.body;

    const email = req.headers["useremail"];
    console.log("calls insertYoutubeLink", youtube_link);

    await checkYouTubeLink(youtube_link, email, res, cancellationToken);
    if (cancellationToken.isCancelled()) {
      console.log("Request cancelled after processing1");
      return res.status(500).json("Request cancelled after processing1");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(response(null, null, "error"));
  }
}

async function checkYouTubeLink(url, email, res, cancellationToken) {
  const videoId = extractVideoId(url);

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails
    ,snippet&id=${videoId}&key=${"AIzaSyB8tyWO9e-pgLAp1kR2g2wAVSyAY_Zh9Jc"}`;

  const resp = await fetch(apiUrl);
  const data = await resp.json();

  if (data.items && data.items.length > 0) {
    const videoInfo = data.items[0];
    const videoLength = videoInfo.contentDetails.duration;
    const videoTitle = videoInfo.snippet.title;

    const formattedLength = convertDurationToSec(videoLength);
    console.log("proceed to getYoutubeData");
    const nameFile = videoTitle;
    await getYoutubeData(
      url,
      nameFile,
      formattedLength,
      email,
      res,
      cancellationToken
    );
    if (cancellationToken.isCancelled()) {
      console.log("Request cancelled after processing2");
      return res.status(500).json("Request cancelled after processing2");
    }
  } else {
    console.log("invalid youtube link!");
    return res.status(500).json(response(null, data, "invalid youtube link!"));
  }
}

async function getYoutubeData(
  url,
  nameFile,
  length,
  email,
  res,
  cancellationToken
) {
  try {
    const respo = await fetch(`https://whisper.chatdox.com/api/getData`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_file: url,
      }),
    });
    const result = await respo.json();

    let textContent = result?.data?.text;

    if (cancellationToken.isCancelled()) {
      console.log("Request cancelled after processing3");
      return res.status(500).json("Request cancelled after processing3");
    }

    console.log("proceed to response");
    return res.status(200).json(
      response(
        {
          nameFile,
          textContent,
          length,
          source_name: url,
          source_type: "new",
          no_of_characters: textContent?.length,
          status: "queued",
          type: "youtube",
        },
        null
      )
    );
  } catch (error) {
    (error) => {
      console.log("Unreadable data!", error);
      return res.status(500).json(response(null, error, "Unreadable data!"));
    };
  }
}

function extractVideoId(url) {
  let videoId = null;
  const watchPattern = /(?:\?v=)([^&]+)/;
  const watchMatch = url.match(watchPattern);
  if (watchMatch && watchMatch[1]) {
    videoId = watchMatch[1];
  } else {
    const bePattern = /youtu\.be\/([^?\s]+)/;
    const beMatch = url.match(bePattern);
    if (beMatch && beMatch[1]) {
      videoId = beMatch[1];
    } else {
      const shortsPattern = /(?:\/shorts\/)([^?\s]+)/;
      const shortsMatch = url.match(shortsPattern);
      if (shortsMatch && shortsMatch[1]) {
        videoId = shortsMatch[1];
      }
    }
  }

  return videoId;
}

function convertDurationToSec(duration) {
  const matches = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = parseInt(matches[1]) || 0;
  const minutes = parseInt(matches[2]) || 0;
  const seconds = parseInt(matches[3]) || 0;
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds;
}

module.exports = {
  insertYoutubeLink,
};
