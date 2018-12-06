async function arxiv(page, href, date)
{
	const xml = await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
	const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
	const [match, category, id] = new RegExp('.+arxiv.org/abs/(.+/)?([^v]+)', 'g').exec(entry.querySelector('id').innerText);
	const url = 'https://arxiv.org/abs/' + (category ? category + '/' + id : id)
	return {
		title : entry.querySelector('title').innerText, 
		authors : Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText),
		abstract : entry.querySelector('summary').innerText,
		id : 'arxiv.' + (category ? category + '_' + id : id),
		url : url,
		pdf : url.replace('arxiv.org/abs/', 'arxiv.org/pdf/'),
		source : 'arxiv.org',
		date : date,
		tags : []
	};
}

async function nips(page, href, date)
{
	const pdf = page.evaluate('//a[text()="[PDF]"]', page).iterateNext().href;
	const bibtex = page.evaluate('//a[text()="[BibTeX]"]', page).iterateNext().href;
	return {
		title : page.querySelector('.subtitle').innerText,
		authors : Array.from(page.querySelectorAll('.author')).map(elem => elem.innerText),
		abstract : page.querySelector('.abstract').innerText,
		id : 'neurips.' + new RegExp('/paper/(\\d+)-.+').exec(pdf)[1],
		url : href,
		pdf : 'https://papers.nips.cc' + pdf,
		bibtex : await (await fetch('https://papers.nips.cc' + bibtex).text()),
		source : 'nips.cc',
		date : date,
		tags : []
	};
}

async function openreview(page, href, date)
{
	const entry = (await (await fetch(href.replace('/forum?id=', '/notes?forum='))).json()).notes.filter(note => note.original != null)[0];
	return {
		title : entry.content.title,
		authors : entry.content.authors,
		abstract : entry.content.abstract,
		id : 'openreview.' + entry.id,
		url : href,
		pdf : 'https://openreview.net' + entry.content.pdf,
		bibtex : entry.content._bibtex,
		source : 'openreview.net',
		date : date,
		tags : []
	}
}

function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org/abs/' : arxiv, 'papers.nips.cc/paper/' : nips, 'openreview.net/forum' : openreview};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
