async function arxiv(page, href, date)
{
	const entry = page.createRange().createContextualFragment(await (await fetch(href.replace('arxiv.org/abs/', 'export.arxiv.org/api/query?id_list='))).text()).querySelector('entry');
	const pdf = find_meta(page, 'citation_pdf_url');
	const url = pdf.replace('/pdf/', '/abs/');
	const arxiv_id = find_meta(page, 'citation_arxiv_id');
	const title = find_meta(page, 'citation_title');
	const year = find_meta(page, 'citation_date').split('/')[0]
	const authors = decomma_authors(find_meta(page, 'citation_author', Array));
	const bibtex = `@misc{${authors[0]}${year}${title.split(' ')[0]}_arXiv:${arxiv_id}, title = {${title}}, author = {${authors.join(', ')}}, year = {${year}}, eprint = {${arxiv_id}}, archivePrefix={arXiv}}`;
	return {
		title : title,
		authors : authors,
		abstract : entry.querySelector('summary').innerText,
		id : 'arxiv.' + arxiv_id.replace('/', '_'),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(bibtex, url, pdf),
		source : 'arxiv.org',
		date : date,
		tags : []
	};
}

async function nips(page, href, date)
{
	const pdf = find_meta(page, 'citation_pdf_url');
	const url = pdf.replace('.pdf', '.html');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract').innerText,
		id : 'neurips.' + new RegExp('/paper/(\\d+)-.+').exec(pdf)[1],
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, '[BibTeX]').replace('http://', 'https://'))).text(), url, pdf),
		source : 'nips.cc',
		date : date,
		tags : []
	};
}

async function openreview(page, href, date)
{
	const entry = (await (await fetch(href.replace('/forum?id=', '/notes?forum='))).json()).notes.filter(note => note.original != null)[0];
	const pdf = find_meta(page, 'citation_pdf_url');
	const url = pdf.replace('/pdf', '/forum');
	return {
		title : entry.content.title,
		authors : entry.content.authors,
		abstract : entry.content.abstract,
		id : 'openreview.' + entry.id,
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(entry.content._bibtex, url, pdf),
		source : 'openreview.net',
		date : date,
		tags : []
	}
}

async function cvf(page, href, date)
{
	const pdf = find_meta(page, 'citation_pdf_url').replace('openaccess/', '');
	const url = pdf.replace('.pdf', '.html');
	return {
		title : find_meta(page, 'citation_title'),
		authors : decomma_authors(find_meta(page, 'citation_author', Array)),
		abstract : page.querySelector('#abstract').innerText,
		id : 'cvf.' + pdf.split('/').pop().replace('_paper.pdf', ''),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(page.querySelector('.bibref').innerText, url, pdf),
		source : 'thecvf.com',
		date : date,
		tags : [],
		arxiv : find_link_by_text(page, 'arXiv')
	}
}

async function hal(page, href, date)
{
	const entry = (await (await fetch(href + (href.endsWith('/') ? '' : '/') + 'json')).json()).response.docs[0];
	const url = entry.uri_s;
	const pdf = entry.files_s[0];
	return {
		title : entry.title_s[0],
		authors : entry.authFullName_s,
		abstract : entry.abstract_s[0],
		id : 'hal.' + entry.halId_s.replace('hal-', ''),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(entry.label_bibtex, url, pdf),
		source : 'hal.archives-ouvertes.fr',
		date : date,
		tags : []
	}
}

function biorxiv(page, href, date)
{
	return highwire(page, href, date, 'biorxiv', 'biorxiv.org');
}

function pnas(page, href, date)
{
	return highwire(page, href, date, 'pnas', 'pnas.org');
}

async function ssrn(page, href, date)
{
	const url = find_meta(page, 'citation_abstract_html_url');
	const pdf = find_meta(page, 'citation_pdf_url');
	const doi = find_meta(page, 'citation_doi');
	return {
		title : find_meta(page, 'citation_title'),
		authors : decomma_authors(find_meta(page, 'citation_author', Array)),
		abstract : page.querySelector('.abstract-text>p').innerText,
		id : doi.split('/')[1],
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await bibtex_crossref(doi), url, pdf),
		source : 'ssrn.com',
		date : date,
		tags : [],
		doi : doi
	}
}

async function projecteuclid(page, href, date)
{
	const url = find_meta(page, 'citation_abstract_html_url');
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract-text>p').innerText,
		id : url.replace('https://projecteuclid.org/', '').replace('/', '_'),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(url.replace('.org/', '.org/export_citations?format=bibtex&h='))).text(), url, pdf),
		source: 'projecteuclid.org',
		date : date,
		tags : [],
		doi : find_meta(page, 'citation_doi')
	}
}

async function aps(page, href, date)
{
	const url = page.querySelector('link[rel="canonical"]').href;
	const pdf = find_meta(page, 'citation_pdf_url');
	const doi = find_meta(page, 'citation_doi');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract .content >p').innerText,
		id : 'aps.' + strip_doi_part(doi),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(page.querySelector('meta[property="og:url"]').content.replace('abstract', 'export'))).text(), url, pdf),
		source : 'aps.org',
		date : date,
		tags : [],
		doi : doi
	}
}

function pmlr(page, href, date)
{
	const url = find_meta(page, 'citation_abstract_html_url');
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('.abstract').innerText,
		id : 'mlr.' + new RegExp(/.+\/(v\d+)\/(.+).html/, 'g').exec(url).slice(1).join('.'),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(page.querySelector('#bibtex').innerText, url, pdf),
		source : 'mlr.press',
		date : date,
		tags: [],
	}
}

async function jmlr(page, href, date)
{
	const pdf = find_meta(page, 'citation_pdf_url');
	const url = pdf.replace('.pdf', '.html');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : page.querySelector('#content>h3').nextSibling.textContent.trim(),
		id : 'jmlr.' + new RegExp(/.+\/papers\/(.+)\/(.+)\/.+/, 'g').exec(pdf).slice(1).join('.'),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, 'bib'))).text(), url, pdf),
		source : 'jmlr.org',
		date : date,
		tags : []
	}
}

async function iacr(page, href, date)
{
	const a = page.querySelectorAll('p a');
	const url = a[a.length - 1];
	const p = page.querySelectorAll('p');
	let abstract = '';
	for(let i = 3; i < p.length; i++)
	{
		if(p[i].innerText.includes('Category'))
			break;
		abstract += p[i].lastChild.textContent + ' ';
	}
	const pdf = a[0].href;
	return {
		title : page.querySelector('b').innerText,
		authors : page.querySelector('i').innerText.split(' and '),
		abstract : abstract.trim(),
		id : 'iacr.' + url.innerText.replace('.', '').replace(/\//g, '.'),
		url : url.href,
		pdf : pdf,
		bibtex : format_bibtex(page.createRange().createContextualFragment(await (await fetch(a[1].href)).text()).querySelector('pre').innerText, url.href, pdf),
		source : 'iacr.org',
		date : date,
		tags : []
	}
}

async function highwire(page, href, date, provider, source)
{
	const url = find_meta(page, 'citation_public_url');
	const pdf = find_meta(page, 'citation_pdf_url');
	return {
		title : find_meta(page, 'citation_title'),
		authors : find_meta(page, 'citation_author', Array),
		abstract : find_meta(page, 'citation_abstract'),
		id : provider + '.' + strip_version(find_meta(page, 'citation_id')),
		url : url,
		pdf : pdf,
		bibtex : format_bibtex(await (await fetch(find_link_by_text(page, 'BibTeX'))).text(), url, pdf),
		source : source,
		date : date,
		tags : [],
		doi : find_meta(page, 'citation_doi')
	}
}

async function bibtex_crossref(doi)
{
	return (await fetch('https://dx.doi.org/' + doi, { headers: {'Accept' : 'text/bibliography; style=bibtex'} } )).text();
}

function find_meta(page, text, type)
{
	const selector = 'meta[name="' + text + '"]';
	return type == Array ? Array.from(page.querySelectorAll(selector)).map(meta => meta.content) : page.querySelector(selector).content;
}

function strip_doi_part(doi)
{
	return doi.split('/')[1].replace('.', '_');
}

function find_link_by_text(page, text)
{
	return page.evaluate('//a[text()="'+ text + '"]', page).iterateNext().href;
}

function strip_version(doc_id)
{
	return new RegExp('(.+)(v.+)?', 'g').exec(doc_id)[1];
}

function decomma_authors(authors)
{
	return authors.map(a => a.split(', ').reverse().join(' '));
}

function parse_bibtex(text)
{
	const parse_bibtex_line = function(text)
	{
		let m = text.match(/^\s*(\S+?)\s*=\s*/);
		if (!m) 
			throw new Error('Unrecogonised line format');
		const name = m[1];
		const search = text.slice(m[0].length);
		const re = /[\n\r,{}]/g;
		const length = m[0].length;
		let braceCount = 0;
		do
		{
			m = re.exec(search);
			if (m[0] === '{')
				braceCount++;
			else if (m[0] === '}')
			{
				if (braceCount ===  0)
					throw new Error('Unexpected closing brace: "}"');
				braceCount--;
			}
		}
		while (braceCount > 0);
		return [name, search.slice(0, re.lastIndex), length + re.lastIndex + m[0].length];
	};

	const m = text.match(/^\s*@([^{]+){\s*([^,\n]+)[,\n]/);
	if (!m) 
		throw new Error('Unrecogonised header format');
	text = text.slice(m[0].length).trim();
	let bib = {};
	while (text[0] !== '}')
	{
		const [field, value, length] = parse_bibtex_line(text);
		bib[field.toLowerCase()] = value;
		text = text.slice(length).trim();
	}
	return [m[1].trim().toLowerCase(), m[2].trim().toLowerCase(), bib];
}

function format_bibtex(bibtex, url, pdf)
{
	try
	{
		let [record_type, citation_key, bib] = parse_bibtex(bibtex);
		bib.url = bib.url || `{${url}}`;
		bib.pdf = bib.pdf || `{${pdf}}`;
		delete bib.abstract;
		const header = ['title', 'author', 'booktitle', 'journal', 'year', 'doi'], footer = ['note', 'pdf', 'url'];
		const keys = header.filter(k => bib.hasOwnProperty(k)).concat(Object.keys(bib).sort().filter(k => !header.includes(k) && !footer.includes(k))).concat(footer.filter(k => bib.hasOwnProperty(k)));
		return `@${record_type}{${citation_key},\n` + keys.map(k => `    ${k} = ${bib[k]}`).join(',\n') + '\n}';
	}
	catch(ex)
	{
		console.log('bibtex parsing error', ex.message);
		return bibtex;
	}
}

function parse_doc(page, href, date)
{
	const parsers = {'arxiv.org' : arxiv, 'nips.cc' : nips, 'openreview.net' : openreview, 'openaccess.thecvf.com' : cvf, 'hal.' : hal, 'biorxiv.org' : biorxiv, 'pnas.org' : pnas, 'papers.ssrn.com' : ssrn, "projecteuclid.org" : projecteuclid, 'journals.aps.org' : aps, 'proceedings.mlr.press' : pmlr, 'jmlr.org' : jmlr, 'eprint.iacr.org' : iacr};
	for(const k in parsers)
		if(href.includes(k))
			return parsers[k](page, href, date);
	return null;
}
