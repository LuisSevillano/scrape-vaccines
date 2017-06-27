// I ended up using promises in this example because of the asynchronicity of all the requests -
// I ran into a problem where I was calling my makeCSV function before I had pushed all of the
// info I wanted into countryInfo.
var Promise = require('bluebird');
var request = require('request-promise');
var cheerio = require('cheerio');
var fs = require('fs');
var d3 = require('d3');

var url = 'https://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';

/// Gathers links corresponding to each animal's individual info page.
function scrapeLinks() {
	// var startingUrl = 'http://www.midwestanimalrescue.org/animals/browse?special=Kittens';
	var startingUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do';
	var countryUrls = [];

	// Makes a request to the startingUrl and then, from the response (which is the startingUrl's HTML),
	// gathers all of the links corresponding to each animal's individual page.
	request(startingUrl, function (error, response, body) {
		// var baseUrl = 'http://www.midwestanimalrescue.org';
		var baseUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';
		var $ = cheerio.load(body);
		// basic error handling
		if (error) {
			throw new Error(error);
		}
		// 'browse' is the class associated with each animal's previewed info. This collects every chunk of HTML with the class
		// 'browse' and then for each chunk finds the 'a' tag and takes the value of the 'href' attribute,
		// which is something like "/animals/detail?AnimalID=10088333". It then adds this specific Url path to the
		// domain Url (http://www.midwestanimalrescue.org) and saves the concatenation as a link to a specific animal.
		// rm first el

		$('#pais > option:not(:selected)').each(function(i, element) {
			$ = cheerio.load(element);

			var extension = $(this).val();
			countryUrls[i] = baseUrl + extension;
		});

		scrapeInfo(countryUrls);
	});
}

// Makes a request to each link corresponding to an animal's page and creates an object based on that animal's
// information, and then sends that object to makeCSV to be put into CSV/spreadsheet format.
function scrapeInfo(countryUrls) {
	var countryInfo = [];
	Promise.map(countryUrls, function(countryUrl) {

		return request(countryUrl, function(error, response, body) {

			var $ = cheerio.load(body);
			if (error) {
				throw new Error(error);
			}

			var countryObj = {
				"Nombre": "",
				"Capital": "",
				"Paludismo": "No existe riesgo de paludismo",
				"Lengua": "",
				"Altitud": "",
				"Población": "",
				"Moneda": "",
				"Zona horaria": "",
				"Clima": "",
				"Vacunas exigidas": "Ningún requisito de vacunación para los viajeros internacionales.",
				"Vacunas recomendadas": "Es conveniente tener actualizado el calendario oficial de vacunaciones. Pueden ser recomendables otras vacunas, cuya prescripción deberá realizarse de forma personalizada en cualquiera de los Centros de Vacunación Internacional autorizados.",
				"Cancillería Española": "",
			};
			var countryName = toTitleCase($("h2").text());
			var tables = $('.imagen_texto table'),
			details = tables[0],
			vacRequired = tables[1],
			vacReccom = tables[2];
			paludismo = tables[3];

			// set country name
			countryObj["Nombre"] = countryName;
			$(details).find("tr").each(function(d, i){
				var property = $(this).find("th").text().trim(),
				value = $(this).find("td").text().trim();
				countryObj[property] = value;
			});

			// country has paludismo table
			if(paludismo){
				countryObj["Paludismo"] = $(paludismo).find("td").text().trim();
			}
			countryObj["Vacunas exigidas"] = $(vacRequired).find("td").text().trim();
			countryObj["Vacunas recomendadas"] = $(vacReccom).find("td").text().trim();

			countryInfo.push(countryObj);
		});
	})
	.then(function() {
		// only calles this function once all of the countryObj have been pushed into
		// countryInfo
		makeCSV(countryInfo);
	});
}

function makeCSV(countryInfo) {
	var animalObj = countryInfo[0];
	// console.log(animalObj);
	var firstRow = "";
	for (var key in animalObj) {
		firstRow += (key + "\t");
	}

	fs.writeFile('countryInfo.tsv', d3.tsvFormat(countryInfo));
	// fs.appendFile('countryInfo.tsv', (firstRow + "\n"));
	// var keys = firstRow.split("\t");
	// for (var i = 0; i < countryInfo.length; i++) {
	// 	var thisRow = "";
	// 	for (var j = 0; j < keys.length; j++) {
	// 		console.log(keys[j]);
	// 		if (countryInfo[i][keys[j]]) {
	// 			thisRow += (countryInfo[i][keys[j]] + "\t");
	// 		}
	// 		else {
	// 			thisRow += "\t";
	// 		}
	// 	}
	// 	fs.appendFile('countryInfo.tsv', (thisRow + "\n"));
	// }
}
function toTitleCase(str) {
	return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
scrapeLinks();
