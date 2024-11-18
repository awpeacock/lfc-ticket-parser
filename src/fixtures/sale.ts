import { EventAttributes } from 'ics';

/**
 * Class representing details of an individual sale (or registration) associated with a fixture.
 */
export default class Sale {

    /** A brief summary of the sale type (e.g. Members Sale) plus any credit restrictions. */
    private description: string;
    /** The status of the sale (either pending, currently active or ended). */
    private status: Status;
    /** The date and time of the sale (if in the future). */
    private date: Nullable<Date>;

    /**
     * Creates a Sale from the parameters provided.
     * @param {string} description - A brief summary of the sale type (e.g. Members Sale) plus any credit restrictions.
     * @param {Status} status - The status of the sale/registration (either pending, currently active or ended).
     * @param {Nullable<Date>} date - The date and time of the sale (if in the future).
     */
    constructor(description: string, status: Status, date: Nullable<Date>) {

        this.description = description;
        this.date = date;
        this.status = status;

    }

    /**
     * Returns a boolean indicating whether the sale/registration is valid for inclusion in a calendar.
     * @return {boolean} A boolean representing whether it is still pending, has a date, isn't a local sale, and isn't for ambulant or hospitality seating.
     */
    isValid(): boolean {

        return this.status == Status.PENDING && this.date != null && !this.description.startsWith('Local') && !this.description.includes('ambulant') && this.description.indexOf('Hospitality') == -1;
    
    }

    /**
     * Returns a readable representation of the sale/registration.
     * @return {Nullable<string>} The title if it is valid, otherwise null.
     */
    getTitle(): Nullable<string> {

        if ( !this.isValid() ) {
            return null;
        }
        const options: Intl.DateTimeFormatOptions = {
            day: "numeric", month: "short", year: "numeric",
            hour: "numeric", minute: "2-digit", 
        };
        const date = this.date!.toLocaleDateString("en-GB", options).replace(' at ', ' ');
        return  date + ' : ' + this.description;

    }

    /**
     * Returns a Json representation of the sale/registration.
     * @return {Nullable<string>} The Json string if it is valid, otherwise null.
     */
    getJson(): Nullable<string> {

        if ( !this.isValid() ) {
            return null;
        }
        return '{"description":"' + this.description + '","date":"' + this.date + '"}';

    }

    /**
     * Returns an ICS event representation of the sale/registration.
     * @return {Nullable<EventAttributes>} The attributes for the event if it is valid, otherwise null.
     */
    getCalendarEvent(): Nullable<EventAttributes> {

        if ( !this.isValid() ) {
            return null;
        }

        // First off, check the offset between UK time and UTC to ensure the correct time is passed to the ICS generator.
        // We force it to recognise this.date as non-null as we can't get past isValid() without a date.
        const uk: string = this.date!.toLocaleTimeString('en-gb', {timeZone: 'Europe/London'});
        const here = this.date!.toLocaleTimeString('en-gb', {timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone});
        const offset = parseInt(here.substring(0,2)) - parseInt(uk.substring(0, 2));
        return {
            productId: 'lfctickets/ics',
            title: this.description,
            start: [this.date!.getFullYear(), this.date!.getMonth() + 1, this.date!.getDate(), this.date!.getHours() + offset, this.date!.getMinutes()],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        };

    }

    /**
     * Compares this sale with another sale and returns whether there is any difference.
     * @param {Sale} sale - The sale with which to compare this instance.
     * @return {boolean} An boolean indicating whether the two sales are identical  or not.
     */
    equals(sale: Sale): boolean {

        const description: boolean = (this.description == sale.description);
        const status: boolean = (this.status == sale.status);
        const date: boolean = ((this.date == null && sale.date == null) || (this.date != null && sale.date != null && this.date!.getFullYear() == sale.date!.getFullYear() && this.date!.getMonth() == sale.date!.getMonth() && this.date!.getDate() == sale.date!.getDate()));
        const time: boolean = ((this.date == null && sale.date == null) || (this.date != null && sale.date != null && this.date!.getHours() == sale.date!.getHours() && this.date!.getMinutes() == sale.date!.getMinutes()));

        return (description && status && date && time);

    }

}