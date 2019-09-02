/**
 * iranica-reader
 *
 * (c) Copyright 2019, mooster@42at.com
 */


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
  console.log('Iranica reader loaded for article:',
    (article.textContent || '').trim()
  );

  // extend latinize
  latinize.characters['š'] = 'sh';

  let contentPs = Array.from($$('#content p'));

  //
  // section headers
  //  <p><em>foo</em>.  content....
  //
  let bib, bibDone = false;
	let bibdiv = document.createElement('details');
	bibdiv.className = 'bibliography';
	bibdiv.innerHTML = '<summary><b>Bibliography</b></summary>';

  contentPs.some(p => {
    let em = p.firstChild;
		let isbib;
    if (!(isbib = /^bibliography/i.test(p.innerText)) &&
			(!em ||
      !(em.nodeName === 'EM' || (em.nodeName === 'A' && em.attributes.name)) ||
      (/\(/.test(em.textContent) && !/\)/.test(em.textContent)) || // mismatched ()
			(/bibliography/i.test(p.className)) || // <p class=bibliography>...
			// bib citation starting with <em>...
			(em.nodeName === 'EM'
			  && p.textContent.length > em.textContent.length + 10
			  && p.textContent.lenth < 156)
    )) {
			// not a header.

			// Handle bib parts.
			if (!bib) return;

			// detect bib end
			let text = p.textContent;
			if ((/^\((\w+\.?\s*){2,5}\)$/.test(text) && text.length < 64) // (author j. name esq.)
			  || /^originally published/i.test(text)
				|| /^last updated/i.test(text)
				|| /^This article is available in print/i.test(text)
		  ) {
				bibDone = true;
			}

			// Is it part of bib?
			if (bib && !bibDone) {
				bibdiv.appendChild(p);
			}
			return;
		}

		// a section after bib indicates bib is done
		if (bib) bibDone = true;

    var newEl = document.createElement('h2');
    newEl.innerHTML = em.innerHTML || p.innerHTML;

    console.log('  #', newEl.textContent);
    if (newEl.textContent.length > 150) return;

    if (!em.innerHTML) {    //  <p><a name></a>fooo</p>
      p.innerHTML = '';
      p.appendChild(newEl);
    } else {
      p.replaceChild(newEl, em);
      p.innerHTML = p.innerHTML.replace(/h2>\s*[\.:]\s*/, 'h2>'); // remove leading period & :
    }

    if (isbib || /bibliography/i.test(em.innerText)) {
			bib = p;
			let extras = bib.firstElementChild/* h2 */.innerHTML.replace(/^bibliography\W*/i, '');
			if (extras.length > 10) bibdiv.innerHTML += `<p>(${extras.replace(/(&nbsp;|[:,;\)])*$/,'')})</p>`;
		}
  });

	if (bib) {
		bib.parentNode.replaceChild(bibdiv, bib);
		bibdiv.parentNode = bib.parentNode;
		bib = bibdiv;
	}

  //
  // citations of type (...<em>...</em>...) or (... pp?. ...) not containing <a>
  //
  let notes = [];
  contentPs.forEach(p => {
    p.innerHTML = p.innerHTML.replace(/\((.*?)\)/g, (a, m) => {
      let orig = `(${m})`;
      if (
        /<a\b/i.test(m) || // skip <a>'s
        /^<em.*em>$/i.test(m) || // skip (<em>foo</em>)
				m.replace(/<[^>]+>/g, '').length < 5  // too short (html stripped)
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
  if (!bib) console.log('No bibliography section found!');
  else {
    let str = '';
    notes.forEach((note, n) => {
      note = note.replace(/^./, m => m.toUpperCase());
      str += `<li><a name="notes-${1+n}"></a>${note}</li>`;
    });
    let ol = document.createElement('ol');
    ol.innerHTML = str;

    let footnote = document.createElement('details');
    footnote.setAttribute('open', '');
    footnote.innerHTML = `<summary><b>Footnote</b></summary>`;
    bib.parentNode.insertBefore(footnote, bib);
    footnote.appendChild(ol);
  }

  //
  // latinize main text and break up long paragraphs
  //
  contentPs.forEach(p => {
    p.innerHTML = splitLongPs(latinize(p.innerHTML));
  });

  //
  // link (q.v.)
  //
	contentPs.forEach(p => {
		let html = p.innerHTML;
		html = html.replace(
		  /(?<article>(\s+ʿ?[A-Z][\w-]+)+)\s+?\(q\.v\.\)/g,
			(...args) => {
				let { article } = args.pop();
				article = article.trim();
				let fa = /[-ʿ]/.test(article);
				let url = fa ?
				    article.replace(/(-e|ʿ)/g,'').replace(/\s+/g,'-').toLowerCase()
				  : article.split(/\s+/).reverse().join('-').toLowerCase();

				console.log(`  q.v.: ${article} > ${url}`);
				return ` <a href="${url}" class="unverified" data-tag="q.v." title="q.v. guess!">${article.trim()}</a>`;
			}
		);
		p.innerHTML = html;
  });

	// verify links (after a bit)
	let links
	setTimeout(() => {
	  links = $$('#content a.unverified');
		if (links.length) {
			console.log(`  verifying ${links.length} q.v. links...`);
			links.forEach(verifyLink);
	  }
	}, 1500);

	function verifyLink(link, n) {
		fetch(link.href).then(resp => {
			if (resp.status === 404) {
				console.log(`    %c✗%c ${link.href}`, 'color: red;', 'color:unset');

				link.attempt = (link.attempt || 0) + 1;
				switch (link.attempt) {
					case 1:
					// case 2: // last one
					  link.href += '-parent';
						verifyLink(link, n);
					  break;
					default:
						// stop!
				}
			} else {
				// success
				link = links[n];
				link.className = '';
				link.title = 'q.v. verified';
				console.log(`    %c✓%c ${link.href}`, 'color: green;', 'color:unset');
			}

		});
	}

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

  if (!sba.length) return;

	// move sidebar thumbnails to top
	let ref = document.querySelector('#content');
	let div = document.createElement('div');
	let el = document.createElement('div');
	el.setAttribute('id', 'sidebar');
	el.className = 'top-sidebar';
	el.appendChild(ai.cloneNode(true));

	ref.parentNode.insertBefore(div, ref);
	div.appendChild(el);
	div.appendChild(ref);
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
