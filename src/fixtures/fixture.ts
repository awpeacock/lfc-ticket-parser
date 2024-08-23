import dotenv from 'dotenv';

import Sale from "./sale";

/**
 * Class representing each upcoming fixture with the relevant information,
 * and functions to retrieve this data and parse it.
 */
export default class Fixture {

    /** A unique identifier for each fixture (generated internally at construction), used to detect changes. */
    readonly id: string;
    /** The URL of the page containing sales dates. */
    private url: string;
    /** The season in which the match is occurring. */
    private season: number;
    /** The name of the opposition for the fixture. */
    private opposition: string;
    /** Whether the fixture is home (H), away (A), neutral (N), or maybe unknown (U). */
    private venue: Venue;
    /** The competition in which the fixture is being played (e.g. Premier League, FA Cup). */
    private competition: string;
    /** The date the fixture is to be played. */
    private ko: Date;

    /** The HTML downloaded from the fixture's individual selling details page. */
    private html: string = '';

    /** An array of sale dates for the fixture (including ended sales and sales that aren't relevant). */
    private sales: Array<Sale> = [];

    /**
     * Creates a Fixture from the parameters provided.
     * @param {string} url - The URL of the page containing sales dates.
     * @param {string} opposition - The name of the opposition for the fixture.
     * @param {Venue} venue - Whether the fixture is home (H), away (A), neutral (N), or maybe unknown (U).
     * @param {string} competition - The competition in which the fixture is being played (e.g. Premier League, FA Cup).
     * @param {Date} ko - The date the fixture is to be played.
     */
    constructor(url: string, opposition: string, venue: Venue, competition: string, ko: Date) {

        // Calculate the first year of the current season (e.g. 2024-25 is 2024) for the unique identifier
        this.season = ko.getFullYear() - (ko.getMonth() < 5 ? 1 : 0);
        // Now onstruct the ID for the fixture from the combo of season, opposition, home/away and competition - 
        // these should always be a unique combination (and also prevent a "new" fixture being created every time 
        // the date/time of kick off changes)
        this.id = (this.season+'-'+opposition+'-'+venue+'-'+competition).toLowerCase().replace(/&amp; /g,'').replace(/ /g, '-');
        this.url = url;
        this.opposition = opposition;
        this.venue = venue;
        this.competition = competition;
        this.ko = ko;

    }

    /**
     * Downloads the HTML file from the Liverpool FC website, using the URL provided
     * in the constructor.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
    */
    async download(): Promise<boolean> {

        dotenv.config();
        if ( !process.env.DOMAIN ) {
            return false;
        }
        try {
            this.html = await fetch(process.env.DOMAIN + this.url).then(res => res.text());
        } catch (e) {
            console.error(e);
            return false;
        }
        return (this.html.length > 0);

    }

    /**
     * Parses the HTML file previously downloaded, and constructs Sale objects from the key information contained within.
     * @return {number} The total number of sale details found.
     * @throws Will throw an error if the HTML is unable to be parsed.
     */
    find(): number {

        if ( this.html == null || this.html == '' ) {
            throw 'HTML is empty';
        }
        // First off, a quick sanity check we've got the right fixture
        const pattern: string = '<title>' + (this.venue == 'A' ? this.opposition + ' V Liverpool Fc' : 'Liverpool Fc V ' + this.opposition) + '.*?</title>'; 
        const title: Nullable<RegExpMatchArray> = this.html.match(pattern);
        if ( title == null ) {
            throw 'Parsing the wrong fixture';
        }
            
        // Now, find each element representing a sale date, registration date, etc.
        const re: RegExp = /<h3>.*?<span class="salename">(.+?)<\/span>.*?(?:<span class="prereqs">(.*?)<\/span>).*?<span class="status">(.+?)<\/span>\s*?(?:(?:<span class="whenavailable">(.+?)(\d{1,2}):(\d{2})([ap]m)<\/span>).*?)?<\/h3>/gis;
        let match : Nullable<RegExpExecArray>;
        while ( (match = re.exec(this.html)) !== null ) {

            // Any tier one fixtures or away games will have pre-requisites (how many credits recorded) for the sale.
            // Make sure to capture this and include in the description to make the information useful.
            let credits: number = 0;
            const prereqs: Nullable<RegExpMatchArray> = match[2].match(/recorded (\d+?)\+/);
            if ( prereqs != null ) {
                credits = parseInt(prereqs[1]);
            }

            const description: string = match[1] + (credits > 0 ? ' (' + credits + '+)' : '');
            const status: Status = (
                (match[3].toLowerCase().indexOf('ended') > -1 || match[3].toLowerCase().indexOf('sold out') > -1) ? Status.ENDED : (
                (match[3].toLowerCase().indexOf('available') > -1 || match[3].toLowerCase().indexOf('buy now') > -1) ? Status.AVAILABLE : 
                Status.PENDING
            ));

            // As with the fixture date, the sale date/time is formatted in such a way that Javascript will throw "Invalid Date" 
            // if you try and convert directly, so a bit of interpretation is required
            let date: Nullable<Date> = null;
            if ( match[4] ) {
                date = new Date(match[4]);
                const hours: number = parseInt(match[5]) + (match[7] == 'pm' ? 12: 0), minutes: number = parseInt(match[6]);
                date.setHours(hours);
                date.setMinutes(minutes);
            }

            const sale: Sale = new Sale(description, status, date);
            this.sales.push(sale);

        }
        return this.sales.length;

    }

    /**
     * Returns a textual description of the fixture to be used in the calendar.
     * @return {string} The fixture's opposition, venue, competition and season.
     */
    getMatch(): string {
        return this.opposition + ' (' + this.venue + ') - ' + this.competition + ' (' + this.season + '-' + (this.season + 1).toString().substring(2) + ')';
    }

    /**
     * Returns a count of sales details that should be included in a calendar.
     * @return {number} The total number of sales/registrations that are pending (not including local sales, hospitality or ambulant seating).
     */
    getActiveSaleCount(): number {
        let count: number = 0;
        this.sales.forEach((sale) => {
            if ( sale.isValid() ) {
                count++;
            }
        });
        return count;
    }

    /**
     * Returns a Json representation of the fixture and all sales.
     * @return {Nullable<string>} The Json for this fixture if it has any valid sales, otherwise null.
     */
    getJson(): Nullable<string> {

        if ( this.getActiveSaleCount() == 0 ) {
            return null;
        }
        
        let json: string = '{"fixture":{"id":"' + this.id + '","match":"' + this.getMatch() + '","sales":[';
        this.sales.forEach((sale) => {
            if ( sale.isValid() ) {
                json += sale.getJson() + ',';
            }
        });
        json = json.substring(0, json.length - 1);
        json += ']}}';
        return json;
    }

}