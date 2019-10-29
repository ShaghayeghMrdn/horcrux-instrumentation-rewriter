self.addEventListener('message', function(e) {
    var setSig = {}, keymap = {};
    var inputSig = e.data;
    Object.keys(inputSig).forEach((k)=>{
        var strSig = inputSig[k];
        var _matchInvocId = Object.values(setSig).indexOf(strSig), matchInvocId;
        if (_matchInvocId>=0){
            matchInvocId = Object.keys(setSig)[_matchInvocId];
            keymap[k] = matchInvocId;
        } else {
            setSig[k] = strSig;
            keymap[k] = k;
        }
    })
  self.postMessage({sig:setSig, keymap:keymap});
}, false);