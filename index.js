var Promise = require('bluebird');
var request = require('request-promise');
var cheerio = require('cheerio');
var fs = require('fs');
var d3Dsv = require('d3-dsv');

var url = 'https://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';

/// Gathers links corresponding to each country individual info page.
function scrapeLinks() {
	var startingUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do';
	var countryUrls = [];

	// Makes a request to the startingUrl and then, from the response (which is the startingUrl's HTML),
	// gathers all of the links corresponding to each country individual page.
	request(startingUrl, function (error, response, body) {
		// var baseUrl = 'http://www.midwestanimalrescue.org';
		var baseUrl = 'http://www.msssi.gob.es/profesionales/saludPaises.do?metodo=verDetallePais&pais=';
		var $ = cheerio.load(body);
		// basic error handling
		if (error) {
			throw new Error(error);
		}

		// gets urls of each country from the Select HTML element without first one which has not data associated
		// and fill and array
		$('#pais > option:not(:selected)').each(function(i, element) {
			$ = cheerio.load(element);

			var extension = $(this).val();
			countryUrls[i] = baseUrl + extension;
		});

		scrapeInfo(countryUrls);
	});
}

// Makes a request to each link corresponding to a country page and creates an object based on that country
// information, and then sends that object to makeTSV to be put into TSV/spreadsheet format.
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

			// get country name
			countryObj["Nombre"] = countryName;
			$(details).find("tr").each(function(d, i){

				var property = $(this).find("th").text().trim(),
				value = $(this).find("td").text().trim();

				countryObj[property] = value;
			});

			// If this country has paludismo info table
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
		makeTSV(countryInfo);
	});
}

function makeTSV(countryInfo) {
	fs.writeFile('countryInfo.tsv', d3Dsv.tsvFormat(countryInfo));
}
function toTitleCase(str) {
	return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
scrapeLinks();
