(() => {
  "use strict";

  function createScanner(dependencies) {
    const { state, $, joinedMateriels, stopScanner, showScannedValue } = dependencies;

    function prepareBarcodeLookup(mode) {
      const column = mode === "inventory" ? "num_inv" : "num_ser";
      state.barcodeLookup = joinedMateriels()
        .map(row => ({ raw: String(row[column] == null ? "" : row[column]).trim(), key: normalizeCode(row[column]) }))
        .filter(item => item.raw && item.key.length >= 4);
      state.barcodeCandidate = "";
      state.barcodeCandidateCount = 0;
      state.scanStatusCandidate = "";
    }
    function acceptBarcodeCandidate(rawValue) {
      const key = normalizeCode(rawValue);
      if (!key || key.length < 4 || !state.detecting) return false;
      const matches = (state.barcodeLookup || []).filter(item => item.key === key);
      if (matches.length !== 1) {
        state.barcodeCandidate = "";
        state.barcodeCandidateCount = 0;
        if (state.scanStatusCandidate !== key) {
          state.scanStatusCandidate = key;
          $("scan-status").textContent = matches.length > 1
            ? "Code détecté mais numéro ambigu dans la base. Stabilisez le code dans le cadre ou saisissez le numéro manuellement."
            : "Code détecté mais non reconnu dans la base pour ce mode. Ajustez le cadrage ou saisissez le numéro manuellement.";
        }
        return false;
      }
      if (state.barcodeCandidate === key) state.barcodeCandidateCount++;
      else { state.barcodeCandidate = key; state.barcodeCandidateCount = 1; }
      $("scan-status").textContent = "Code reconnu. Confirmation de la lecture " + Math.min(state.barcodeCandidateCount, 2) + "/2…";
      if (state.barcodeCandidateCount < 2) return false;
      state.detecting = false;
      stopScanner();
      showScannedValue(matches[0].raw);
      return true;
    }
    async function startScanner(mode) {
      stopScanner();
      state.lastScanMethod = "barcode";
      state.scanMode = mode;
      state.scanReturnTo = "start";
      $("scan-panel").classList.remove("manual-only");
      $("start-screen").classList.add("hidden"); $("import-panel").classList.add("hidden"); $("workspace").classList.add("hidden"); $("scan-panel").classList.remove("hidden");
      $("scan-title").textContent = mode === "inventory" ? "Scanner le numéro d’inventaire" : "Scanner le numéro de série";
      $("manual-scan-value").value = "";
      $("manual-scan-value").classList.remove("scan-value-success");
      $("scan-status").className = "status";
      if (!state.db) { $("scan-status").textContent = "Aucune base locale importée. Importez d’abord le fichier SQLite."; return; }
      if (!navigator.mediaDevices?.getUserMedia) { $("scan-status").textContent = "Caméra indisponible. Ouvrez l’application dans un navigateur compatible et saisissez le numéro ci-dessous."; return; }
      prepareBarcodeLookup(mode);
      if (!state.barcodeLookup.length) { $("scan-status").textContent = "Aucun numéro exploitable n’est disponible dans la base pour ce mode. Vous pouvez saisir le numéro manuellement."; return; }
      const video = $("scanner-video");
      video.setAttribute("autoplay", ""); video.setAttribute("playsinline", ""); video.muted = true;
  
      // Native BarcodeDetector first; use ZXing if native initialization fails.
      if ("BarcodeDetector" in window) {
        try {
          const supported = await BarcodeDetector.getSupportedFormats();
          const wanted = ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];
          const formats = wanted.filter(format => supported.includes(format));
          if (!formats.length) throw new Error("Aucun format compatible avec BarcodeDetector.");
          const detector = new BarcodeDetector({ formats });
          state.scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
          video.srcObject = state.scanStream;
          await video.play();
          state.detector = detector;
          state.detecting = true;
          $("scan-status").textContent = "Caméra active. Placez le code-barres bien net dans le cadre.";
          const detectFrame = async () => {
            if (!state.detecting || !video.srcObject) return;
            try {
              const codes = await detector.detect(video);
              for (const code of codes || []) if (acceptBarcodeCandidate(code.rawValue)) return;
            } catch (error) { console.warn("Échec ponctuel du décodage natif", error); }
            if (state.detecting) state.scanFrame = requestAnimationFrame(detectFrame);
          };
          state.scanFrame = requestAnimationFrame(detectFrame);
          return;
        } catch (nativeError) {
          console.warn("BarcodeDetector indisponible; bascule vers ZXing", nativeError);
          if (state.scanStream) state.scanStream.getTracks().forEach(track => track.stop());
          state.scanStream = null; state.detector = null; state.detecting = false;
          video.pause(); video.srcObject = null;
        }
      }
      if (!window.ZXing?.BrowserMultiFormatReader) {
        $("scan-status").textContent = "Le moteur de scan n’a pas pu être chargé. Vérifiez la connexion puis rechargez la page, ou saisissez le numéro manuellement.";
        return;
      }
      try {
        const formats = [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.CODE_93, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.CODABAR].filter(format => format !== undefined);
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        if (formats.length) hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        state.codeReader = new ZXing.BrowserMultiFormatReader(hints, 250);
        $("scan-status").textContent = "Activation de la caméra arrière…";
        state.detecting = true;
        state.scanControls = await state.codeReader.decodeFromVideoDevice(undefined, video, (result, error, controls) => {
          if (controls && !state.scanControls) state.scanControls = controls;
          if (result && state.detecting) acceptBarcodeCandidate(result.getText());
        });
        if (state.detecting) $("scan-status").textContent = "Caméra active. Approchez le code, gardez-le net et évitez les reflets.";
      } catch (error) {
        stopScanner();
        const message = error.name === "NotAllowedError" ? "Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur."
          : error.name === "NotFoundError" ? "Aucune caméra compatible détectée sur cet appareil."
          : "Impossible d’activer le scan : " + (error.message || "vérifiez les permissions.");
        $("scan-status").textContent = message + " Vous pouvez saisir le numéro manuellement.";
      }
    }
    async function startOCR(mode) {
      stopScanner();
      state.lastScanMethod = "ocr";
      state.scanMode = mode;
      state.scanReturnTo = "start";
      $("scan-panel").classList.remove("manual-only");
      $("start-screen").classList.add("hidden"); $("import-panel").classList.add("hidden"); $("workspace").classList.add("hidden"); $("scan-panel").classList.remove("hidden");
      $("scan-title").textContent = mode === "inventory" ? "Lire le numéro d’inventaire (OCR)" : "Lire le numéro de série (OCR)";
      $("scan-status").className = "status";
      $("scan-status").textContent = "Préparation de la caméra…";
      $("manual-scan-value").value = "";
      if (!state.db) { $("scan-status").textContent = "Importez d’abord une base SQLite."; return; }
      if (!navigator.mediaDevices?.getUserMedia) { $("scan-status").textContent = "Caméra indisponible. Saisissez le numéro manuellement."; return; }
      if (!window.Tesseract?.createWorker) { $("scan-status").textContent = "Le moteur OCR n’est pas chargé. Ouvrez l’application une fois avec Internet, puis rechargez-la."; return; }
      try {
        const video = $("scanner-video");
        video.setAttribute("autoplay", ""); video.setAttribute("playsinline", ""); video.muted = true;
        state.scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        video.srcObject = state.scanStream;
        await video.play();
        if (!state.ocrWorker) {
          $("scan-status").textContent = "Initialisation du moteur OCR (première utilisation)…";
          state.ocrWorker = await Tesseract.createWorker("eng", 1, {
            workerPath: "./vendor/tesseract.js/dist/worker.min.js",
            corePath: "./vendor/tesseract.js-core",
            langPath: "./vendor/traineddata",
            cacheMethod: "write",
            gzip: false
          });
          await state.ocrWorker.setParameters({
            tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./",
            tessedit_pageseg_mode: "7",
            preserve_interword_spaces: "0"
          });
        }
        // Le mode automatique cherche le texte lu dans les deux champs : numéro d’inventaire et numéro de série.
        const columnsToSearch = mode === "auto" ? ["num_inv", "num_ser"] : [mode === "inventory" ? "num_inv" : "num_ser"];
        const canonical = [...new Set(joinedMateriels().flatMap(row =>
          columnsToSearch.map(column => row[column]).filter(value => value != null && String(value).trim())
            .map(value => String(value).trim())
        ))].map(raw => ({ raw, key: normalizeCode(raw) })).filter(item => item.key.length >= 4);
        const exactIndex = new Map(canonical.map(item => [item.key, item.raw]));
        const levenshteinOne = (a, b) => {
          if (a === b) return true;
          if (Math.abs(a.length - b.length) > 1) return false;
          let i = 0, j = 0, edits = 0;
          while (i < a.length && j < b.length) {
            if (a[i] === b[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (a.length > b.length) i++;
            else if (b.length > a.length) j++;
            else { i++; j++; }
          }
          return edits + ((i < a.length || j < b.length) ? 1 : 0) <= 1;
        };
        const matchCandidate = token => {
          const key = normalizeCode(token);
          if (key.length < 4) return null;
          if (exactIndex.has(key)) return exactIndex.get(key);
          // OCR commonly confuses 0/O, 1/I and 5/S. Try these substitutions before a one-character typo.
          const variants = [key.replace(/O/g,"0").replace(/I/g,"1").replace(/S/g,"5"), key.replace(/0/g,"O").replace(/1/g,"I").replace(/5/g,"S")];
          for (const variant of variants) if (exactIndex.has(variant)) return exactIndex.get(variant);
          if (key.length < 6) return null;
          const possible = canonical.filter(item => item.key.length >= 6 && levenshteinOne(key, item.key));
          return possible.length === 1 ? possible[0].raw : null;
        };
        state.detecting = true;
        state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
        $("scan-status").textContent = "OCR actif. Placez uniquement le numéro dans le cadre et rapprochez le téléphone.";
        // Deux zones complémentaires : étiquette entière, puis texte sous le code-barres.
        // Cela évite de faire dépendre la lecture de la seule zone centrale.
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const lowerCanvas = document.createElement("canvas");
        const lowerContext = lowerCanvas.getContext("2d", { willReadFrequently: true });
  
        function makeOCRCrop(targetCanvas, targetContext, xRatio, yRatio, widthRatio, heightRatio, binarize) {
          const sx = Math.round(video.videoWidth * xRatio);
          const sy = Math.round(video.videoHeight * yRatio);
          const sw = Math.max(1, Math.round(video.videoWidth * widthRatio));
          const sh = Math.max(1, Math.round(video.videoHeight * heightRatio));
          const scale = Math.min(2.5, 2200 / sw);
          targetCanvas.width = Math.max(1, Math.round(sw * scale));
          targetCanvas.height = Math.max(1, Math.round(sh * scale));
          targetContext.drawImage(video, sx, sy, sw, sh, 0, 0, targetCanvas.width, targetCanvas.height);
  
          const frame = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
          const pixels = frame.data;
          const histogram = new Uint32Array(256);
          let minLuma = 255, maxLuma = 0, total = 0;
          for (let p = 0; p < pixels.length; p += 4) {
            const luma = Math.round(0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]);
            pixels[p] = pixels[p + 1] = pixels[p + 2] = luma;
            histogram[luma]++;
            if (luma < minLuma) minLuma = luma;
            if (luma > maxLuma) maxLuma = luma;
            total++;
          }
          if (maxLuma - minLuma < 22) return false;
  
          // Étirement du contraste pour le texte imprimé ou écrit au feutre.
          const contrast = 255 / Math.max(1, maxLuma - minLuma);
          for (let p = 0; p < pixels.length; p += 4) {
            const value = Math.max(0, Math.min(255, Math.round((pixels[p] - minLuma) * contrast)));
            pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
          }
  
          // Seuillage d'Otsu facultatif, surtout utile pour les caractères au feutre.
          if (binarize) {
            // Recalculer l'histogramme après l'étirement du contraste : les deux images
            // doivent utiliser la même échelle de luminosité.
            histogram.fill(0);
            for (let p = 0; p < pixels.length; p += 4) histogram[pixels[p]]++;
            let sum = 0;
            for (let i = 0; i < 256; i++) sum += i * histogram[i];
            let sumBackground = 0, weightBackground = 0, bestVariance = -1, threshold = 145;
            for (let i = 0; i < 256; i++) {
              weightBackground += histogram[i];
              if (!weightBackground) continue;
              const weightForeground = total - weightBackground;
              if (!weightForeground) break;
              sumBackground += i * histogram[i];
              const meanBackground = sumBackground / weightBackground;
              const meanForeground = (sum - sumBackground) / weightForeground;
              const variance = weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);
              if (variance > bestVariance) { bestVariance = variance; threshold = i; }
            }
            for (let p = 0; p < pixels.length; p += 4) {
              const value = pixels[p] < threshold ? 0 : 255;
              pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
            }
          }
          targetContext.putImageData(frame, 0, 0);
          return true;
        }
  
        const matchOCRText = recognizedText => {
          const text = String(recognizedText || "").toUpperCase();
          const tokens = text.match(/[A-Z0-9][A-Z0-9./-]{3,}/g) || [];
          const normalizedText = normalizeCode(text);
          let matched = canonical.find(item => normalizedText.includes(item.key))?.raw || null;
          if (!matched) matched = tokens.map(matchCandidate).find(Boolean) || null;
          if (!matched && tokens.length > 1) {
            for (let i = 0; i < tokens.length && !matched; i++) {
              let joined = "";
              for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
                joined += tokens[j];
                matched = matchCandidate(joined);
                if (matched) break;
              }
            }
          }
          return { matched, tokens };
        };
  
        state.detecting = true;
        state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
        $("scan-status").textContent = "OCR actif. Placez l’étiquette entière dans le cadre ; le texte sous le code-barres et le numéro au feutre seront essayés séparément.";
        const scanOCRFrame = async () => {
          if (!state.detecting || !video.srcObject) return;
          if (!state.ocrBusy && video.videoWidth && video.videoHeight) {
            state.ocrBusy = true;
            try {
              let recognizedText = "";
              let result = { matched: null, tokens: [] };
  
              // Passe 1 : zone large, du haut au bas de l’étiquette. Le numéro peut être écrit seul,
              // sans code-barres et à n’importe quelle hauteur dans l’image.
              if (makeOCRCrop(canvas, context, 0.03, 0.08, 0.94, 0.84, false)) {
                await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "11" });
                const first = await state.ocrWorker.recognize(canvas);
                recognizedText = String(first.data.text || "").toUpperCase();
                result = matchOCRText(recognizedText);
              }
  
              // Passe 2 : zone basse, où se trouve généralement le numéro imprimé sous le code-barres.
              // Seuillage noir/blanc pour renforcer les traits fins et les caractères épais.
              if (!result.matched && makeOCRCrop(lowerCanvas, lowerContext, 0.10, 0.43, 0.80, 0.29, true)) {
                await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "7" });
                const second = await state.ocrWorker.recognize(lowerCanvas);
                const secondText = String(second.data.text || "").toUpperCase();
                const secondResult = matchOCRText(secondText);
                if (secondResult.matched) result = secondResult;
                if (secondText.trim()) recognizedText = (recognizedText + " " + secondText).trim();
              }
  
              // Passe 3 : le numéro manuscrit seul peut être mieux reconnu comme une ligne unique.
              // On binarise la zone large puis on demande à Tesseract de lire une seule ligne.
              if (!result.matched && makeOCRCrop(canvas, context, 0.03, 0.08, 0.94, 0.84, true)) {
                await state.ocrWorker.setParameters({ tessedit_pageseg_mode: "7" });
                const third = await state.ocrWorker.recognize(canvas);
                const thirdText = String(third.data.text || "").toUpperCase();
                const thirdResult = matchOCRText(thirdText);
                if (thirdResult.matched) result = thirdResult;
                if (thirdText.trim()) recognizedText = (recognizedText + " " + thirdText).trim();
              }
  
              if (result.matched) {
                const matched = result.matched;
                if (state.ocrLastCandidate === matched) state.ocrCandidateCount++;
                else { state.ocrLastCandidate = matched; state.ocrCandidateCount = 1; }
                $("scan-status").textContent = "Numéro probable : " + matched + " · confirmation " + state.ocrCandidateCount + "/2";
                if (state.ocrCandidateCount >= 2) {
                  state.detecting = false;
                  if (mode === "auto") {
                    const rows = joinedMateriels();
                    const invMatch = rows.some(row => normalizeCode(row.num_inv) === normalizeCode(matched));
                    state.scanMode = invMatch ? "inventory" : "serial";
                  }
                  showScannedValue(matched, true);
                  return;
                }
              } else {
                const tokens = recognizedText.match(/[A-Z0-9][A-Z0-9./-]{3,}/g) || [];
                // Même sans correspondance dans la base, conserver la lecture OCR stable dans le champ vert.
                const readable = tokens.find(token => normalizeCode(token).length >= 4) || "";
                if (mode === "auto" && readable) {
                  if (state.ocrLastCandidate === readable) state.ocrCandidateCount++;
                  else { state.ocrLastCandidate = readable; state.ocrCandidateCount = 1; }
                  $("scan-status").textContent = "Texte lu : « " + readable + " », vérification de la lecture " + state.ocrCandidateCount + "/2. Aucun équipement correspondant n’a encore été confirmé.";
                  if (state.ocrCandidateCount >= 2) {
                    state.detecting = false;
                    state.scanMode = "auto";
                    showScannedValue(readable, false);
                    return;
                  }
                } else {
                  state.ocrLastCandidate = ""; state.ocrCandidateCount = 0;
                  $("scan-status").textContent = tokens.length
                    ? "Texte détecté : « " + tokens.slice(0, 3).join(" ") + " », mais aucun numéro confirmé. Gardez l’étiquette entière dans le cadre."
                    : "Lecture en cours… rapprochez le téléphone, évitez les reflets et gardez l’étiquette entière dans le cadre.";
                }
              }
            } catch (ocrError) {
              console.warn("Erreur de reconnaissance OCR", ocrError);
              $("scan-status").textContent = "Lecture en cours. Gardez l’étiquette nette et bien éclairée ; essayez aussi de cadrer le numéro écrit au feutre.";
            } finally { state.ocrBusy = false; }
          }
          if (state.detecting) state.ocrTimer = window.setTimeout(scanOCRFrame, 350);
        };
        state.ocrTimer = window.setTimeout(scanOCRFrame, 100);
      } catch (error) {
        stopScanner();
        $("scan-status").textContent = "Impossible de démarrer l’OCR : " + (error.message || "vérifiez les permissions de la caméra.");
      }
    }
    function normalizeCode(value) {
      return String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
  
    return Object.freeze({ prepareBarcodeLookup, acceptBarcodeCandidate, startScanner, startOCR, normalizeCode });
  }

  window.GparcScanner = Object.freeze({ createScanner });
})();
