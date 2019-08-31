

console.log('--- background.js');

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

// add click handler to top-sidebar's image toggle
chrome.runtime.onMessage.addListener(
  function(message, callback) {
      chrome.tabs.executeScript({
        code: `setTimeout(()=>
jQuery('.top-sidebar h2.expand-toggle').click(function(){
jQuery(this).next().slideToggle();
}), 1000);`
      });
 });
