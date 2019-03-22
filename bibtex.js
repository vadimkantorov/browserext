ZrxivBibtex =
{
	parse : function(text)
	{
		const parse_bibtex_line = function(text)
		{
			let m = text.match(/^\s*(\S+?)\s*=\s*/);
			if (!m) 
				throw new Error('Unrecogonised line format');
			const name = m[1];
			const search = text.slice(m[0].length);
			const re = /[\n\r,{}]/g;
			let length = m[0].length;
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
			const value = search.slice(0, re.lastIndex);
			length += re.lastIndex;

			while(true)
			{
				m = re.exec(search);
				if(m[0] != '{' && m[0] != '}')
					length += m[0].length;
				else
					break;
			}

			return [name, value, length];
		};

		let bibs = [];
		while(text.length > 0)
		{
			const m = text.match(/^\s*@([^{]+){\s*([^,\n]+)[,\n]/);
			if (!m) 
				throw new Error('Unrecogonised header format');
			text = text.slice(m[0].length).trim();
			let bib = {};
			while (text[0] !== '}')
			{
				let [field, value, length] = parse_bibtex_line(text);
				while(value.startsWith('{') && value.endsWith('}'))
					value = value.slice(1, -1);
				bib[field.toLowerCase()] = value;
				text = text.slice(length).trim();
			}
			if(text[0] == '}')
				text = text.slice(1).trim();
			
			bib.bibtex_record_type = m[1].trim().toLowerCase();
			bib.bibtex_citation_key = m[2].trim().toLowerCase();
			bib.authors = (bib.author.includes(' and ') ? bib.author.split(' and ') : bib.author.split(', ')).map(author => 
			{
				if(author.includes(','))
				{
					let splitted = author.split(',');
					author = splitted.slice(1).join(' ') + ' ' + splitted[0];
				}
				return author;
			});
			delete bib.author;
			bibs.push(bib);
		}
		return bibs;
	},

	format : function(bibs)
	{
		bibs = bibs.map(bib =>
		{
			bib = Object.assign({}, bib);
			bib.author = bib.authors.join(' and ');
			return bib;
		});
		const exclude_keys = ['bibtex_record_type', 'bibtex_citation_key', 'authors', 'abstract'];
		const header = ['title', 'author', 'booktitle', 'journal', 'year', 'doi'], footer = ['note', 'pdf', 'url'];
		return bibs.map(bib => `@${bib.bibtex_record_type}{${bib.bibtex_citation_key},\n` + header.filter(k => bib.hasOwnProperty(k)).concat(Object.keys(bib).sort().filter(k => !header.includes(k) && !footer.includes(k))).concat(footer.filter(k => bib.hasOwnProperty(k))).filter(k => !exclude_keys.includes(k)).map(k => `    ${k} = {${bib[k]}}`).join(',\n') + '\n}').join('\n\n');
	},

	sanitize_abstract : function(abs)
	{
		return abs.replace(/\s+/g, ' ').trim();
	},

	sanitize_url : function(url)
	{
		while(url.startsWith('{') && url.endsWith('}'))
			url = url.slice(1, -1);
		const prefix = '\\url';
		if(url.startsWith(prefix))
			url = url.slice(prefix.length);
		while(url.startsWith('{') && url.endsWith('}'))
			url = url.slice(1, -1);
	},

	sanitize_author : function(author)
	{
	}
};
