async function arxiv(page, href, date)
{
	const xml = await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text();
	const entry = document.createRange().createContextualFragment(xml).querySelector('entry');
	const [match, category, id] = new RegExp('.+arxiv.org/abs/(.+/)?([^v]+)', 'g').exec(entry.querySelector('id').innerText);
	const url = 'https://arxiv.org/abs/' + (category ? category + '/' + id : id)
	return {
		title : entry.querySelector('title').innerText, 
		author : Array.from(entry.querySelectorAll('author name')).map(elem => elem.innerText),
		abstract : entry.querySelector('summary').innerText,
		id : 'arxiv.' + (category ? category + '_' + id : id),
		url : url,
		pdf : url.replace('arxiv.org/abs/', 'arxiv.org/pdf/'),
		source : 'arxiv.org',
		date : date,
		tags : []
	};
}

function nips(page, href, date)
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
		bibtex : 'https://papers.nips.cc' + bibtex,
		source : 'nips.cc',
		date : date,
		tags : []
	};
}

async function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org/abs/' : arxiv, 'papers.nips.cc/paper/' : nips};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
