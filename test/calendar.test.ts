import {describe, it, expect, jest} from '@jest/globals';
import * as ICS from 'ics'

import { FixtureList } from "../src/fixtures";
import setup from "./setup";

setup();

describe('Converting the fixture list', () => {

    const index: FixtureList = new FixtureList();
    let events: string = '';

    it('should successfully create a calendar file', async () => {
        await index.download();
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
        expect(() => { events = index.getCalendarEvents() }).not.toThrow();
        expect(events.length > 0).toBe(true);
        expect(events.startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(events.endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('should successfully merge sales on the same date into a "bulk" sale', async () => {
        expect(events.includes('Chelsea (H) : Members Sale')).toBe(false);
        expect(events.includes('Brighton and Hove Albion (H) : Members Sale')).toBe(false);
        expect(events.includes('Aston Villa (H) : Members Sale')).toBe(false);
        expect(events.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : Memb\s*?ers Sale \(13\+\)/gis)).not.toBeNull();
        expect(events.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : Memb\s*?ers Sale \(4\+\)/gis)).not.toBeNull();
    });

    it('should throw errors if it cannot product the calendar file', async () => {
        // Override the original mock to force the download to fail, so we can
        // check find() handles this correctly (but also hide console error logs
        // so that they only show us useful stuff during testing)
        const fetch = jest.spyOn(ICS, 'createEvents');
        fetch.mockImplementationOnce(() => { return { error: 'Something went wrong', value: null }}); 

        expect(() => index.getCalendarEvents()).toThrow();
    });

});