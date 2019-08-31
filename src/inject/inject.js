/**
 * iranica-reader
 *
 * (c) Copyright 2019, mooster@42at.com
 */


console.log('inject.js -- ', $.fn)

chrome.extension.sendMessage({}, function(response) {
  var readyStateCheckInterval = setInterval(function() {
    if (document.readyState === "complete") {
      clearInterval(readyStateCheckInterval);
      run();
    }
  }, 100);
});

let $$ = document.querySelectorAll.bind(document);


function run() {
  let article = document.querySelector('#article-overview');
  if (!article) return;

  document.body.className += ' iranica-reader';
  console.log('Iranica reader loaded for:',
    (article.textContent || '').trim()
  );

  // extend latinize
  latinize.characters['š'] = 'sh';

  let contentPs = $$('#content p');

  //
  // section headers
  //  <p><em>foo</em>.  content....
  //  <p><a name></a>fooo</p>
  //
  let bib;
  contentPs.forEach(p => {
    let em = p.firstChild;
    if (!em ||
      !(em.nodeName === 'EM' || (em.nodeName === 'A' && em.attributes.name)) ||
      (/\(/.test(em.textContent) && !/\)/.test(em.textContent)) // mismatched ()
    ) return;

    var newEl = document.createElement('h2');
    newEl.innerHTML = em.innerHTML || p.innerHTML;

    console.log(111, newEl.textContent.length, newEl.textContent)
    if (newEl.textContent.length > 150) return;

    if (!em.innerHTML) {
      p.innerHTML = '';
      p.appendChild(newEl);
    } else {
      p.replaceChild(newEl, em);
      p.innerHTML = p.innerHTML.replace(/h2>\.\s*/, 'h2>'); // remove leading period
    }

    if (/bibliography/i.test(em.innerText)) bib = p;
  });


  //
  // citations of type (...<em>...</em>...) or (... pp?. ...) not containing <a>
  //
  let notes = [];
  contentPs.forEach(p => {
    p.innerHTML = p.innerHTML.replace(/\((.*?)\)/g, (a, m) => {
      let orig = `(${m})`;

      if (
        /<a\b/i.test(m) || // skip <a>'s
        /^<em.*em>$/i.test(m) // skip (<em>foo</em>)
      ) {
        return orig;
      }
      if (/<em>/i.test(m) || /\bpp?\./.test(m)) {
        notes.push(latinize(m)); // latinize
        let n = notes.length;
        return `<sup>[<a href="#notes-${n}"><code>${n}</code></a>]</sup>`;
      }
      return orig;
    });
  });

  //
  // add footnotes
  //
  if (!bib) console.warn('No bibliography section found!');
  else {
    let str = '';
    notes.forEach((note, n) => {
      note = note.replace(/^./, m => m.toUpperCase());
      str += `<li><a name="notes-${1+n}"></a>${note}</li>`;
    });
    let ol = document.createElement('ol');
    ol.innerHTML = str;

    let newbib = document.createElement('details');
    newbib.setAttribute('open', '');
    newbib.innerHTML = `<summary><b>Footnotes</b></summary>`;
    bib.parentNode.insertBefore(newbib, bib);
    newbib.appendChild(ol);
  }

  //
  // latinize main text and break up long paragraphs
  //
  contentPs.forEach(p => {
    p.innerHTML = splitLongPs(latinize(p.innerHTML));
  });

  //
  // dates:
  //
  contentPs.forEach(p => {
    // 1265/1840
    // 1265-78/140-50
    let html = p.innerHTML;
    html = html.replace(
      /(?<hd>\d{4}-?(\d{2,})?)\/(?<gd>\d{4}-?(\d{2,})?)/g,
      '<abbr title="$<hd>">$<gd></abbr>');
    // 22 Farvardin 1209/11 September 1830
    // Farvardin, 1209/September, 1830
    // Rabiʿ II, 1309/...
    html = html.replace(
      /(?<hd>\b(\d{1,2}\s+)?[A-Z]\w+(ʿ?\s*I+)?(,?\s+)?\d{4}-?(\d{2,})?)\/(?<gd>\b(\d{1,2}\s+)?[A-Z]\w+(,?\s+)?\d{4}-?(\d{2,})?)/g,
      '<abbr title="$<hd>">$<gd></abbr>');

    p.innerHTML = html;
  });

  //
  // add citation as title
  // title="${t.textContent}"
  //
  $$('#content p sup').forEach(p => {
    let c = p.querySelector('code');
    if (!c) return; // not our <sup>
    let n = c.textContent - 1;
    let a = p.querySelector('a');
    let t = document.createElement('span');
    t.innerHTML = notes[n];
    a.setAttribute('title', t.textContent);
  });

  // TODO
  //   images are lightbox

  doImages();
  addExtMarker();
}

// https://stackoverflow.com/questions/5499078/fastest-method-to-escape-html-tags-as-html-entities
function escapeHTML(html) {
    return document.createElement('div').appendChild(document.createTextNode(html)).parentNode.innerHTML;
}

function doImages() {
	// content images
	$$('#content a[href*=".jpg"]').forEach(anchor => {
		anchor.classList.add('strip');
		anchor.setAttribute('data-strip-group', 'iranica-reader-article');
		anchor.setAttribute('data-strip-group-options', 'loop: false');
		anchor.setAttribute('data-strip-caption', escapeHTML(anchor.innerHTML));
	});

	// sidebar thumbnails
	let sba = $$('#article-images ul a[rel="pretty[sidebar]"]');
	sba.forEach(anchor => {
		anchor.classList.add('strip');
		anchor.setAttribute('data-strip-group', 'iranica-reader-sidebar');
		anchor.setAttribute('data-strip-group-options', 'loop: false');
		anchor.setAttribute('data-strip-caption', escapeHTML(anchor.title));
	});

  // add counter
	let ai = document.querySelector('#article-images');
	let h2 = ai.querySelector('h2');
	if (h2) h2.innerHTML = sba.length + ' ' + h2.innerHTML;

	// move sidebar thumbnails to top
	let ref = document.querySelector('#content');
	let el = document.createElement('div');
	el.setAttribute('id', 'sidebar');
	el.className = 'top-sidebar';
	el.appendChild(ai);
	ref.parentNode.insertBefore(el, ref);
}

function addExtMarker() {
  let marker = document.createElement('div');
  marker.innerHTML = 'Iranica Reader mode';
  marker.className = 'iranica-reader-marker';
  marker.setAttribute('title', 'To see original view, turn off the Iranica Reader extension in your browser.')
  document.body.appendChild(marker);
}

function splitLongPs(html, N = 5) {
  let i = 0;
  return html
    .split(/\.\s+(?=[A-Z])/)
    .map(t => {
      return t.length < 50 || /<\/?sup>/.test(t) || (++i % N) ? t : (i = 0, `<br/><br/>${t}`);
    })
    .join('. ');
};
