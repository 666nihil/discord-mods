(function () {
  var patches = [];
  var hooked = [];

  function getStorage() { return vendetta.plugin.storage; }
  function toast(msg) {
    try { vendetta.ui.toasts.showToast(msg); } catch (e) { console.log("[HomeroRingtone] " + msg); }
  }
  function isRing(s) { return typeof s === "string" && /call_ringing/i.test(s); }

  function hookNativeSoundManager() {
    var np = window.nativeModuleProxy || window.__turboModuleProxy;
    var mgr = np && np.DCDSoundManager;
    if (!mgr || typeof mgr.prepare !== "function") return false;
    // prepare(uri, soundType, key, callback): se cambia la URI cuando es el sonido de llamada
    patches.push(vendetta.patcher.before("prepare", mgr, function (args) {
      var url = (getStorage().url || "").trim();
      if (!url) return;
      var uri = args[0], key = args[2];
      var s = (uri && (uri.uri || uri)) + "";
      if (isRing(s) || isRing(key)) {
        args[0] = typeof uri === "object" ? Object.assign({}, uri, { uri: url }) : url;
      }
    }));
    hooked.push("DCDSoundManager.prepare");
    return true;
  }

  function hookJsSoundModule() {
    var mod = vendetta.metro.findByProps("createSound", "playSound");
    if (!mod) return false;
    patches.push(vendetta.patcher.before("createSound", mod, function (args) {
      var url = (getStorage().url || "").trim();
      if (url && isRing(args[0])) args[1] = url;
    }));
    hooked.push("createSound");
    return true;
  }

  return {
    onLoad: function () {
      var st = getStorage();
      if (typeof st.url !== "string") st.url = "";
      var ok = false;
      try { ok = hookNativeSoundManager() || ok; } catch (e) { console.log("[HomeroRingtone] native hook failed", e); }
      try { ok = hookJsSoundModule() || ok; } catch (e) { console.log("[HomeroRingtone] js hook failed", e); }
      if (!ok) toast("HomeroRingtone: no se pudo enganchar el sonido de llamada");
      else if (!st.url) toast("HomeroRingtone: falta configurar la URL del mp3");
    },
    onUnload: function () {
      patches.forEach(function (u) { try { u(); } catch (e) {} });
      patches = []; hooked = [];
    },
    settings: function () {
      var common = vendetta.metro.common;
      var React = common.React, RN = common.ReactNative;
      vendetta.storage.useProxy(getStorage());
      var st = getStorage();
      return React.createElement(RN.View, { style: { padding: 16 } },
        React.createElement(RN.Text, { style: { color: "#fff", marginBottom: 8 } }, "URL del mp3 (tono de llamada)"),
        React.createElement(RN.TextInput, {
          value: st.url, placeholder: "https://raw.githubusercontent.com/.../homero-tono-de-llamada.mp3",
          placeholderTextColor: "#888", autoCapitalize: "none", autoCorrect: false,
          onChangeText: function (v) { st.url = v; },
          style: { color: "#fff", borderWidth: 2, borderColor: "#a0a0a0", backgroundColor: "#000", padding: 10 }
        }),
        React.createElement(RN.Text, { style: { color: "#a0a0a0", marginTop: 12 } },
          "Reiniciá la app después de cambiar la URL. Hooks activos: " + (hooked.join(", ") || "ninguno"))
      );
    }
  };
})()
