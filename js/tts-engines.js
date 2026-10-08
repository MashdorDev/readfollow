
var browserTtsEngine = brapi.tts ? new BrowserTtsEngine() : (typeof speechSynthesis != 'undefined' ? (hasBackgroundPage() ? new BackgroundSpeechEngine() : new WebSpeechEngine()) : new DummyTtsEngine());
var googleTranslateTtsEngine = new GoogleTranslateTtsEngine();
var amazonPollyTtsEngine = new AmazonPollyTtsEngine();
var ibmWatsonTtsEngine = new IbmWatsonTtsEngine();
var phoneTtsEngine = new PhoneTtsEngine();
var openaiTtsEngine = new OpenaiTtsEngine();
var azureTtsEngine = new AzureTtsEngine();
const piperTtsEngine = new PiperTtsEngine()
const supertonicTtsEngine = new SupertonicTtsEngine()
const nghiTtsEngine = new NghiTtsEngine()


//synthesized audio cache
const cache = {
  entries: new Map(),
  maxEntries: 5,
  async fetchCached(key, fetchFn, destroyFn) {
    const entry = this.entries.get(key)
    if (entry) return entry.value
    const value = await fetchFn()
    this.entries.set(key, {value, destroyFn})
    while (this.entries.size > this.maxEntries) {
      const [oldestKey, oldest] = this.entries.entries().next().value
      oldest.destroyFn?.(oldest.value)
      this.entries.delete(oldestKey)
    }
    return value
  }
}


/*
interface Options {
  voice: {
    voiceName: string
  }
  lang: string
  rate?: number
  pitch?: number
  volume?: number
}

interface Event {
  type: string
}

interface Voice {
  voiceName: string
  lang: string
}

interface TtsEngine {
  speak: function(text: string, opts: Options, playbackState$: Observable<"paused"|"resumed">): Observable<TtsEvent>
  getVoices: function(): Voice[]
}
*/

function BrowserTtsEngine() {
  brapi.tts.stop()    //workaround: chrome.tts.speak doesn't work first time on cold start for some reason
  this.speak = function(text, options, onEvent) {
    brapi.tts.speak(text, {
      voiceName: options.voice.voiceId || options.voice.voiceName,
      lang: options.lang,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      requiredEventTypes: ["start", "end"],
      desiredEventTypes: ["start", "end", "error", "word"],
      onEvent: onEvent
    })
  }
  this.stop = brapi.tts.stop;
  this.pause = brapi.tts.pause;
  this.resume = brapi.tts.resume;
  this.isSpeaking = brapi.tts.isSpeaking;
  this.getVoices = async function() {
    const voices = await new Promise(f => brapi.tts.getVoices(f)) || []
    const platform = await brapi.runtime.getPlatformInfo()
    if (platform.os == "mac") {
      for (const voice of voices) {
          if (voice.remote == false && !voice.voiceName.includes(" ")) {
            voice.voiceId = voice.voiceName
            voice.voiceName = "MacOS " + (languageTable.getNameFromCode(voice.lang) || voice.lang) + " [" + voice.voiceId + "]"
          }
      }
    }
    return voices
      .filter(voice => !isPiperVoice(voice) && !isSupertonicVoice(voice))
  }
}


function WebSpeechEngine() {
  var utter;
  this.speak = function(text, options, onEvent) {
    utter = new SpeechSynthesisUtterance();
    utter.text = text;
    utter.voice = options.voice;
    if (options.lang) utter.lang = options.lang;
    if (options.pitch) utter.pitch = options.pitch;
    if (options.rate) utter.rate = options.rate;
    if (options.volume) utter.volume = options.volume;
    utter.onstart = onEvent.bind(null, {type: 'start', charIndex: 0});
    utter.onend = onEvent.bind(null, {type: 'end', charIndex: text.length});
    utter.onboundary = function(event) {
      if (event.name == "word") onEvent({type: 'word', charIndex: event.charIndex, length: event.charLength});
    };
    utter.onerror = function(event) {
      if (event.error == "canceled" || event.error == "interrupted") return;
      onEvent({type: 'error', error: new Error(event.error)});
    };
    speechSynthesis.cancel()
    speechSynthesis.speak(utter);
  }
  this.stop = function() {
    if (utter) utter.onend = null;
    speechSynthesis.cancel();
  }
  this.pause = function() {
    speechSynthesis.pause();
  }
  this.resume = function() {
    speechSynthesis.resume();
  }
  this.isSpeaking = function(callback) {
    callback(speechSynthesis.speaking);
  }
  this.getVoices = function() {
    return promiseTimeout(1500, "Timeout WebSpeech getVoices", new Promise(function(fulfill) {
      var voices = speechSynthesis.getVoices() || [];
      if (voices.length) fulfill(voices);
      else speechSynthesis.onvoiceschanged = function() {
        fulfill(speechSynthesis.getVoices() || []);
      }
    }))
    .then(function(voices) {
      for (var i=0; i<voices.length; i++) voices[i].voiceName = voices[i].name;
      return voices;
    })
    .catch(function(err) {
      console.error(err);
      return [];
    })
  }
}


//Firefox: relays speech to the background page, see background-speech.js
function BackgroundSpeechEngine() {
  const webSpeech = new WebSpeechEngine()
  const keepAliveInterval = 20*1000
  let utterId = null
  let onEvent = null
  let keepAliveTimer = null

  registerMessageListener("backgroundSpeechClient", {
    onSpeechEvent(id, event) {
      if (id != utterId || !onEvent) return
      if (event.type == "end" || event.type == "error") setActive(false)
      onEvent(event)
    }
  })

  this.speak = function(text, options, callback) {
    utterId = Math.random().toString(36).slice(2)
    onEvent = callback
    setActive(true)
    send("speak", [utterId, text, {
      voiceName: options.voice.voiceName,
      lang: options.lang,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
    }])
    .catch(err => {
      setActive(false)
      callback({type: "error", error: err})
    })
  }
  this.stop = function() {
    onEvent = null
    setActive(false)
    send("stop").catch(console.error)
  }
  this.pause = () => send("pause").catch(console.error)
  this.resume = () => send("resume").catch(console.error)
  this.isSpeaking = callback => send("isSpeaking").then(callback, () => callback(false))
  this.getVoices = webSpeech.getVoices

  function setActive(active) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = active ? setInterval(() => send("keepAlive").catch(console.error), keepAliveInterval) : null
  }

  async function send(method, args) {
    const result = await brapi.runtime.sendMessage({dest: "backgroundSpeech", method, args})
    if (result && result.error) throw result.error
    return result
  }
}

function hasBackgroundPage() {
  const background = brapi.runtime.getManifest().background
  return background != null && background.scripts != null
}


function DummyTtsEngine() {
  this.getVoices = function() {
    return Promise.resolve([]);
  }
}


function TimeoutTtsEngine(baseEngine, startTimeout, endTimeout) {
  let speakSub
  this.speak = function(text, options, onEvent) {
    speakSub = new rxjs.Observable(observer => {
      baseEngine.speak(text, options, event => observer.next(event))
    }).pipe(
      rxjs.timeout({
        first: startTimeout,
        with() {
          console.debug(`No 'start' event after ${startTimeout}, will call stop() and retry once`)
          baseEngine.stop()
          return rxjs.throwError(() => new Error("Timeout, TTS never started, try picking another voice?"))
        }
      }),
      rxjs.retry(1),
      rxjs.mergeMap(event =>
        rxjs.iif(
          () => event.type == "start",
          rxjs.timer(endTimeout).pipe(
            rxjs.map(() => {
              console.debug(`No 'end' event after ${endTimeout}, will call stop() and generate 'end'`)
              baseEngine.stop()
              return {type: "end", charIndex: text.length}
            }),
            rxjs.startWith(event)
          ),
          rxjs.of(event)
        )
      ),
      rxjs.catchError(error => rxjs.of({type: "error", error})),
      rxjs.takeWhile(event => event.type != "end" && event.type != "error", true)
    ).subscribe(onEvent)
  }
  this.stop = function() {
    if (speakSub) speakSub.unsubscribe()
    baseEngine.stop();
  }
  this.isSpeaking = baseEngine.isSpeaking;
}


function GoogleTranslateTtsEngine() {
  this.ready = function() {
    return googleTranslateReady();
  };
  this.speak = function(utterance, options, playbackState$) {
    options.rateAdjust = 1.1
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = function() {
    return voices;
  }
  function getAudioUrl(text, {voice: {lang}}) {
    assert(text && lang);
    return cache.fetchCached(
      JSON.stringify([text, lang]),
      () => googleTranslateSynthesizeSpeech(text, lang)
      //data URL, no destroy()
    )
  }
  var voices = [
      {"voice_name": "GoogleTranslate Afrikaans", "lang": "af", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Albanian", "lang": "sq", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Arabic", "lang": "ar", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Armenian", "lang": "hy", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bengali", "lang": "bn", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bosnian", "lang": "bs", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Bulgarian", "lang": "bg", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Catalan", "lang": "ca", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Chinese", "lang": "zh-CN", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Croatian", "lang": "hr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Czech", "lang": "cs", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Danish", "lang": "da", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Dutch", "lang": "nl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate English", "lang": "en", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Esperanto", "lang": "eo", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Estonian", "lang": "et", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Filipino", "lang": "fil", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Finnish", "lang": "fi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate French", "lang": "fr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate German", "lang": "de", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Greek", "lang": "el", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Gujarati", "lang": "gu", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hebrew", "lang": "he", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hindi", "lang": "hi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Hungarian", "lang": "hu", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Icelandic", "lang": "is", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Indonesian", "lang": "id", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Italian", "lang": "it", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Japanese", "lang": "ja", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Javanese", "lang": "jw", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Kannada", "lang": "kn", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Khmer", "lang": "km", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Korean", "lang": "ko", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Latin", "lang": "la", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Latvian", "lang": "lv", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Macedonian", "lang": "mk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Malay", "lang": "ms", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Malayalam", "lang": "ml", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Marathi", "lang": "mr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Myanmar (Burmese)", "lang": "my", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Nepali", "lang": "ne", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Norwegian", "lang": "no", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Polish", "lang": "pl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Portuguese", "lang": "pt", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Romanian", "lang": "ro", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Russian", "lang": "ru", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Serbian", "lang": "sr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Sinhala", "lang": "si", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Slovak", "lang": "sk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Spanish", "lang": "es", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Sundanese", "lang": "su", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Swahili", "lang": "sw", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Swedish", "lang": "sv", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Tagalog", "lang": "tl", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Tamil", "lang": "ta", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Telugu", "lang": "te", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Thai", "lang": "th", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Turkish", "lang": "tr", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Ukrainian", "lang": "uk", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Urdu", "lang": "ur", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Vietnamese", "lang": "vi", "event_types": ["start", "end", "error"]},
      {"voice_name": "GoogleTranslate Welsh", "lang": "cy", "event_types": ["start", "end", "error"]}
    ]
    .map(function(item) {
      return {voiceName: item.voice_name, lang: item.lang};
    })
}


function AmazonPollyTtsEngine() {
  var getPolly = lazy(createPolly)
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = async function() {
    try {
      const {awsCreds, pollyVoices} = await getSettings(["awsCreds", "pollyVoices"])
      if (!awsCreds) return []
      if (pollyVoices && pollyVoices.expire > Date.now()) return pollyVoices.list
      const list = await fetchVoices()
      await updateSettings({pollyVoices: {list, expire: Date.now() + 24*3600*1000}})
      return list
    }
    catch (err) {
      console.error(err)
      return []
    }
  }
  async function fetchVoices() {
    const polly = await getPolly()
    const data = await polly.describeVoices().promise()
    const voices = []
    for (const voice of data.Voices) {
      assert(voice.SupportedEngines && voice.Id)
      if (voice.SupportedEngines.includes("standard")) voices.push(voice);
      if (voice.SupportedEngines.includes("neural")) voices.push({...voice, Style: "neural"})
      if (polly.newscasterVoices.includes(voice.Id)) voices.push({...voice, Style: "newscaster"})
      if (polly.conversationalVoices.includes(voice.Id)) voices.push({...voice, Style: "conversational"})
    }
    return voices.map(voice => {
      assert(voice.Gender)
      let voiceName = `AmazonPolly ${voice.LanguageName} (${voice.Id})`;
      if (voice.Style) voiceName += ` +${voice.Style}`;
      return {
        voiceName,
        lang: voice.LanguageCode,
        langs: voice.AdditionalLanguageCodes
          ? [voice.LanguageCode, ...voice.AdditionalLanguageCodes]
          : undefined,
        gender: voice.Gender.toLowerCase(),
      }
    })
  }
  function getAudioUrl(text, {lang, voice}) {
    assert(text && lang && voice);
    var matches = voice.voiceName.match(/^AmazonPolly .* \((\w+)\)( \+\w+)?$/);
    var voiceId = matches[1];
    var style = matches[2] && matches[2].substr(2);
    return cache.fetchCached(
      JSON.stringify([text, voiceId, style]),
      async () => {
        const polly = await getPolly()
        const blob = await polly.synthesizeSpeech(getOpts(text, voiceId, style)).promise()
        return URL.createObjectURL(blob);
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
  function createPolly() {
    return getSettings(["awsCreds"])
      .then(function(items) {
        if (!items.awsCreds) throw new Error("Missing AWS credentials");
        return new AWS.Polly({
          region: "us-east-1",
          accessKeyId: items.awsCreds.accessKeyId,
          secretAccessKey: items.awsCreds.secretAccessKey
        })
      })
  }
  function getOpts(text, voiceId, style) {
    switch (style) {
      case "newscaster":
        return {
          OutputFormat: "mp3",
          Text: '<speak><amazon:domain name="news">' + escapeXml(text) + '</amazon:domain></speak>',
          TextType: "ssml",
          VoiceId: voiceId,
          Engine: "neural"
        }
      case "conversational":
        return {
          OutputFormat: "mp3",
          Text: '<speak><amazon:domain name="conversational">' + escapeXml(text) + '</amazon:domain></speak>',
          TextType: "ssml",
          VoiceId: voiceId,
          Engine: "neural"
        }
      case "neural":
        return {
          OutputFormat: "mp3",
          Text: text,
          VoiceId: voiceId,
          Engine: "neural"
        }
      default:
        return {
          OutputFormat: "mp3",
          Text: text,
          VoiceId: voiceId
        }
    }
  }
}


function IbmWatsonTtsEngine() {
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = function() {
    return getSettings(["watsonVoices", "ibmCreds"])
      .then(function(items) {
        if (!items.ibmCreds) return [];
        if (items.watsonVoices && Date.now()-items.watsonVoices[0].ts < 24*3600*1000) return items.watsonVoices;
        return fetchVoices(items.ibmCreds.apiKey, items.ibmCreds.url)
          .then(function(list) {
            list[0].ts = Date.now();
            updateSettings({watsonVoices: list}).catch(console.error);
            return list;
          })
          .catch(function(err) {
            console.error(err);
            return [];
          })
      })
  }
  this.fetchVoices = fetchVoices;

  function getAudioUrl(text, {voice}) {
    assert(text && voice);
    var matches = voice.voiceName.match(/^IBM-Watson .* \((\w+)\)$/);
    var voiceName = voice.lang + "_" + matches[1] + "Voice";
    return cache.fetchCached(
      JSON.stringify([text, voiceName]),
      async () => {
        const settings = await getSettings(["ibmCreds"])
        const blob = await ajaxGet({
          url: settings.ibmCreds.url + "/v1/synthesize?text=" + encodeURIComponent(escapeHtml(text)) + "&voice=" + encodeURIComponent(voiceName) + "&accept=" + encodeURIComponent("audio/ogg;codecs=opus"),
          headers: {
            Authorization: "Basic " + btoa("apikey:" + settings.ibmCreds.apiKey)
          },
          responseType: "blob"
        })
        return URL.createObjectURL(blob);
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
  function fetchVoices(apiKey, url) {
    return ajaxGet({
        url: url + "/v1/voices",
        headers: {
          Authorization: "Basic " + btoa("apikey:" + apiKey)
        }
      })
      .then(JSON.parse)
      .then(function(data) {
        return data.voices.map(item => {
          item.description = item.description.replace(/Chinese \((Mandarin|Cantonese)\)/, "Chinese, $1");
          return {
            voiceName: "IBM-Watson " + item.description.split(/: | male| female| \(/)[1] + " (" + item.name.slice(item.language.length+1, -5) + ")",
            lang: item.language,
            gender: item.gender,
          }
        })
      })
  }
}


function PhoneTtsEngine() {
  var isSpeaking = false
  var conn
  const pendingRequests = new Map()
  const getPairingCode = lazy(() => 100000 + Math.floor(Math.random() * 900000))
  const getPeer = lazy(async () => {
    const peer = new Peer("readaloud-" + getPairingCode(), {debug: 2})
    await new Promise((f,r) => peer.once("open", f).once("error", r))
    peer.on("connection", newConn => {
      const makeError = reason => new Error(JSON.stringify({code: "error_phone_disconnected", reason}))
      newConn.readyPromise = new Promise((fulfill, reject) => {
        newConn.once("open", fulfill)
          .once("error", err => reject(makeError(err.message || err)))
      })
      newConn.once("close", () => newConn.readyPromise = Promise.reject(makeError("Connection lost")))
      newConn.on("error", console.error)
      newConn.on("data", res => {
        const pending = pendingRequests.get(res.id)
        if (pending) {
          if (res.error) pending.reject(new Error(res.error))
          else pending.fulfill(res.value)
        }
        else {
          console.warn("Response received but no pending request", res)
        }
      })
      newConn.peerConnection.addEventListener("connectionstatechange", () => {
        //https://bugs.chromium.org/p/chromium/issues/detail?id=982793#c15
        if (newConn.peerConnection.connectionState == "failed") newConn.close()
      })
      if (conn) conn.close()
      conn = newConn
    })
    window.addEventListener("beforeunload", () => peer.destroy())
    return peer
  })
  this.startPairing = async function() {
    if (conn) {
      conn.close()
      conn = null
    }
    const peer = await getPeer()
    if (peer.disconnected) peer.reconnect()
    return getPairingCode()
  }
  this.isPaired = async function() {
    return conn != null
  }
  async function sendRequest(req, timeout) {
    req.id = String(Math.random())
    await conn.readyPromise
    conn.send(req)
    const responsePromise = new Promise((fulfill, reject) => pendingRequests.set(req.id, {fulfill, reject}))
    try {
      return await promiseTimeout(timeout || 5000, "Request timed out", responsePromise)
    }
    catch(err) {
      if (err.message == "Request timed out") {
        console.warn("Request timed out, assuming phone connection lost")
        conn.close()
      }
      throw err
    }
    finally {
      pendingRequests.delete(req.id)
    }
  }
  this.speak = function(text, options, onEvent) {
    if (!conn) {
      onEvent({type: "error", error: new Error(JSON.stringify({code: "error_phone_not_connected"}))})
      return
    }
    sendRequest({
        method: "speak",
        text,
        options: {
          lang: options.lang,
          rate: options.rate,
          pitch: options.pitch,
          volume: options.volume
        }
      })
      .then(({speechId}) => {
        onEvent({type: "start", charIndex: 0})
        isSpeaking = true
        sendRequest({method: "waitFinish", speechId}, 3*60*1000)
          .then(() => onEvent({type: "end", charIndex: text.length}),
            err => {
              if (err.message != "interrupted") onEvent({type: "error", error: err})
            })
          .finally(() => isSpeaking = false)
      })
      .catch(err => {
        if (err.message != "canceled") onEvent({type: "error", error: err})
      })
  }
  this.stop = function() {
    if (!conn) return;
    sendRequest({method: "stop"}).catch(console.error)
  }
  this.pause = function() {
    sendRequest({method: "pause"}).catch(console.error)
  }
  this.resume = function() {
    sendRequest({method: "resume"}).catch(console.error)
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.getVoices = function() {
    return [
      {voiceName: "Use My Phone", remote: false, isUseMyPhone: true},
    ]
  }
}


function OpenaiTtsEngine() {
  this.defaultEndpointUrl = "https://api.openai.com/v1"
  this.defaultVoiceList = [
    {voice: "alloy", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "ash", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "coral", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "echo", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "fable", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "onyx", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "nova", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "sage", langs: ["en-US", "zh-CN"], model: "tts-1"},
    {voice: "shimmer", langs: ["en-US", "zh-CN"], model: "tts-1"},
  ]
  this.test = async function({apiKey, url, voiceList}) {
    const res = await fetch(url + "/models", {
      headers: {"Authorization": "Bearer " + apiKey}
    })
    if (!res.ok) {
      const {error} = await res.json()
      throw error
    }
  }
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  }
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  }
  this.getVoices = async function() {
    const openaiCreds = await getSetting("openaiCreds")
    const voiceList = openaiCreds ? (openaiCreds.voiceList || this.defaultVoiceList) : []
    return voiceList.map(({voice, lang, langs}) => ({
      voiceName: "OpenAI " + voice,
      lang,
      langs
    }))
  }
  function getAudioUrl(text, {voice}) {
    assert(text && voice)
    const voiceId = voice.voiceName.slice(7)
    return cache.fetchCached(
      JSON.stringify([text, voiceId]),
      async () => {
        const {openaiCreds} = await getSettings(["openaiCreds"])
        const voiceInfo = openaiCreds.voiceList.find(x => x.voice == voiceId)
        assert(voiceInfo, "Voice not found " + voiceId)
        const res = await fetch(openaiCreds.url + "/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(
              openaiCreds.apiKey ? {
                "Authorization": "Bearer " + openaiCreds.apiKey
              } : null
            )
          },
          body: JSON.stringify({
            model: voiceInfo.model,
            input: text,
            voice: voiceInfo.voice,
            instructions: voiceInfo.instructions,
            response_format: "mp3",
          })
        })
        if (!res.ok) throw await res.json().then(x => x.error)
        return URL.createObjectURL(await res.blob())
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
}


function AzureTtsEngine() {
  this.speak = function(utterance, options, playbackState$) {
    const urlPromise = getAudioUrl(utterance, options)
    return playAudio(urlPromise, options, playbackState$)
  };
  this.prefetch = function(utterance, options) {
    getAudioUrl(utterance, options)
      .catch(console.error)
  };
  this.getVoices = async function() {
    try {
      const {azureCreds, azureVoices} = await getSettings(["azureCreds", "azureVoices"])
      if (!azureCreds) return []
      if (azureVoices && azureVoices.expire > Date.now()) return azureVoices.list
      const list = await this.fetchVoices(azureCreds.region, azureCreds.key)
      await updateSettings({azureVoices: {list, expire: Date.now() + 24*3600*1000}})
      return list
    }
    catch (err) {
      console.error(err)
      return []
    }
  }
  this.fetchVoices = async function(region, key) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
      }
    })
    if (!res.ok) throw new Error("Server return " + res.status)
    const voices = await res.json()
    return voices.map(item => {
      const name = item.ShortName.split("-")[2]
      return {
        voiceName: "Azure " + item.LocaleName + " - " + name,
        lang: item.Locale,
        gender: item.Gender == "Male" ? "male" : "female",
      }
    })
  }
  function getAudioUrl(text, {lang, voice}) {
    const matches = voice.voiceName.match(/^Azure .* - (\w+)$/)
    const voiceName = voice.lang + "-" + matches[1]
    return cache.fetchCached(
      JSON.stringify([text, lang, voiceName]),
      async () => {
        const {azureCreds} = await getSettings(["azureCreds"])
        const {region, key} = azureCreds
        const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "ogg-48khz-16bit-mono-opus",
          },
          body: `<speak version='1.0' xml:lang='${lang}'><voice name='${voiceName}'>${escapeXml(text)}</voice></speak>`
        })
        if (!res.ok) throw new Error("Server return " + res.status)
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      },
      blobUrl => URL.revokeObjectURL(blobUrl)
    )
  }
}


function PiperTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const piperPromise = rxjs.firstValueFrom(piperObservable)
    control = new rxjs.Subject()
    control
      .pipe(
        rxjs.startWith("speak"),
        rxjs.concatMap(async cmd => {
          const piper = await piperPromise
          switch (typeof cmd == "string" ? cmd : cmd.type) {
            case "speak":
              return piper.sendRequest("speak", {
                utterance,
                voiceName: options.voice.voiceName,
                pitch: options.pitch,
                rate: options.rate,
                volume: options.volume,
                externalPlayback: options.rate && options.rate != 1,
              })
            case "pause":
              return piper.sendRequest("pause")
            case "resume":
              return piper.sendRequest("resume")
            case "stop":
              return piper.sendRequest("stop")
                .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
            case "forward":
              return piper.sendRequest("forward")
            case "rewind":
              return piper.sendRequest("rewind")
            case "seek":
              return piper.sendRequest("seek", {index: cmd.index})
          }
        }),
        rxjs.ignoreElements(),
        rxjs.mergeWith(piperCallbacks),
        rxjs.map(event => {
          if (event.type == "error") throw event.error
          return event
        }),
        rxjs.takeWhile(event => event.type != "end")
      )
      .subscribe({
        next(event) {
          if (event.type == "start") isSpeaking = true
          onEvent(event)
        },
        complete() {
          onEvent({type: "end"})
        },
        error(err) {
          if (err.name != "interrupted") onEvent({type: "error", error: err})
        }
      })
      .add(() => {
        isSpeaking = false
        control = null
      })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}


function SupertonicTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const supertonicPromise = rxjs.firstValueFrom(supertonic$)
    control = new rxjs.Subject()
    control.pipe(
      rxjs.startWith("speak"),
      rxjs.concatMap(async cmd => {
        const supertonic = await supertonicPromise
        switch (typeof cmd == "string" ? cmd : cmd.type) {
          case "speak":
            return supertonic.sendRequest("speak", {
              utterance,
              voiceName: options.voice.voiceName,
              pitch: options.pitch,
              rate: options.rate,
              volume: options.volume,
              externalPlayback: options.rate && options.rate != 1,
            })
          case "pause":
            return supertonic.sendRequest("pause")
          case "resume":
            return supertonic.sendRequest("resume")
          case "stop":
            return supertonic.sendRequest("stop")
              .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
          case "forward":
            return supertonic.sendRequest("forward")
          case "rewind":
            return supertonic.sendRequest("rewind")
          case "seek":
            return supertonic.sendRequest("seek", {index: cmd.index})
        }
      }),
      rxjs.ignoreElements(),
      rxjs.mergeWith(supertonicCallbacks),
      rxjs.map(event => {
        if (event.type == "error") throw event.error
        return event
      }),
      rxjs.takeWhile(event => event.type != "end")
    )
    .subscribe({
      next(event) {
        if (event.type == "start") isSpeaking = true
        onEvent(event)
      },
      complete() {
        onEvent({type: "end"})
      },
      error(err) {
        if (err.name != "interrupted") onEvent({type: "error", error: err})
      }
    })
    .add(() => {
      isSpeaking = false
      control = null
    })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}


function NghiTtsEngine() {
  let control = null
  let isSpeaking = false
  this.speak = function(utterance, options, onEvent) {
    const nghiTtsPromise = rxjs.firstValueFrom(nghiTtsObservable)
    control = new rxjs.Subject()
    control.pipe(
      rxjs.startWith("speak"),
      rxjs.concatMap(async cmd => {
        const nghiTts = await nghiTtsPromise
        switch (typeof cmd == "string" ? cmd : cmd.type) {
          case "speak":
            return nghiTts.sendRequest("speak", {
              utterance,
              voiceName: options.voice.voiceName,
              pitch: options.pitch,
              rate: options.rate,
              volume: options.volume,
            })
          case "pause":
            return nghiTts.sendRequest("pause")
          case "resume":
            return nghiTts.sendRequest("resume")
          case "stop":
            return nghiTts.sendRequest("stop")
              .then(() => Promise.reject({name: "interrupted", message: "Playback interrupted"}))
          case "forward":
            return nghiTts.sendRequest("forward")
          case "rewind":
            return nghiTts.sendRequest("rewind")
          case "seek":
            return nghiTts.sendRequest("seek", {index: cmd.index})
        }
      }),
      rxjs.ignoreElements(),
      rxjs.mergeWith(nghiTtsCallbacks),
      rxjs.map(event => {
        if (event.type == "error") throw event.error
        return event
      }),
      rxjs.takeWhile(event => event.type != "end")
    )
    .subscribe({
      next(event) {
        if (event.type == "start") isSpeaking = true
        onEvent(event)
      },
      complete() {
        onEvent({type: "end"})
      },
      error(err) {
        if (err.name != "interrupted") onEvent({type: "error", error: err})
      }
    })
    .add(() => {
      isSpeaking = false
      control = null
    })
  }
  this.isSpeaking = function(callback) {
    callback(isSpeaking)
  }
  this.pause = function() {
    control?.next("pause")
  }
  this.resume = function() {
    control?.next("resume")
  }
  this.stop = function() {
    control?.next("stop")
  }
  this.forward = function() {
    control?.next("forward")
  }
  this.rewind = function() {
    control?.next("rewind")
  }
  this.seek = function(index) {
    control?.next({type: "seek", index})
  }
}
