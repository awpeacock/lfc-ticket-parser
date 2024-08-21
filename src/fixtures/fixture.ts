/**
 * Class representing each upcoming fixture with the relevant information,
 * and functions to retrieve this data and parse it.
 */
export default class Fixture {

    /** A unique identifier for each fixture (generated internally at construction), used to detect changes. */
    readonly id: string;
    /** The URL of the page containing sales dates. */
    private url: string;
    /** The name of the opposition for the fixture. */
    private opposition: string;
    /** Whether the fixture is home (H), away (A), neutral (N), or maybe unknown (U). */
    private venue: Venue;
    /** The competition in which the fixture is being played (e.g. Premier League, FA Cup). */
    private competition: string;
    /** The date the fixture is to be played. */
    private ko: Date;

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
        const season: number = ko.getFullYear() - (ko.getMonth() < 5 ? 1 : 0);
        // Now onstruct the ID for the fixture from the combo of season, opposition, home/away and competition - 
        // these should always be a unique combination (and also prevent a "new" fixture being created every time 
        // the date/time of kick off changes)
        this.id = (season+'-'+opposition+'-'+venue+'-'+competition).toLowerCase().replace(/&amp; /g,'').replace(/ /g, '-');
        this.url = url;
        this.opposition = opposition;
        this.venue = venue;
        this.competition = competition;
        this.ko = ko;

    }

}