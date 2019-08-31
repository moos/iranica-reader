

console.log('--- main.js');

chrome.webRequest.onBeforeRequest.addListener(
  function(a,b) {
    console.log('onBeforeRequest', a,b);

    if (typeof $ !== 'undefined' && $.fn && !$.fn.prettyPhoto) $.fn.prettyPhoto = (el) => {
      console.log('$.fn.prettyPhoto blocked', el)
    };

    return {
      cancel: true
    };
  }, {
    urls: [
      "*://*.iranicaonline.org/js/jquery.prettyPhoto.js",
      "*://*.iranicaonline.org/css/prettyPhoto.css",
      "*://*.iranicaonline.org/css/prettyPhoto-updates.css"
    ]
  },
  ["blocking"]
);
