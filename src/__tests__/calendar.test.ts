import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import dotenv, { DotenvConfigOutput } from 'dotenv';
import * as ICS from 'ics';
import * as nodemailer from 'nodemailer';
import { NodemailerMock } from 'nodemailer-mock';

import { FixtureList, Sale } from "../fixtures";
import { Email } from '../distribution';
import { Backup } from '../persistence';
import setup, { Mocks } from "../setupTests";

setup();

describe('Converting the fixture list and sending the calendar email', () => {

    const { mock } = nodemailer as unknown as NodemailerMock;

    const index: FixtureList = new FixtureList();
    let events: Array<ICS.EventAttributes> = new Array<ICS.EventAttributes>();

    beforeEach(() => {
        mock.reset();
        mock.setSuccessResponse('250 OK');
    });

    it('should successfully create an array of calendar events', async () => {
        await index.download();
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
        expect(() => { events = index.getChanges() }).not.toThrow();
        expect(events.length > 0).toBe(true);
        expect(events[0]).toEqual({productId: 'lfctickets/ics',title: 'Brentford (H) : Additional Members Sale',start: [2024,8,19,11,0],duration: {minutes: 60},busyStatus: 'BUSY'});
    });

    it('should return null if an attempt is made to retrieve an event for an invalid sale', () => {

        const sale: Sale = new Sale('Event in the past', Status.ENDED, null);
        expect(sale.isValid()).toBe(false);
        expect(sale.getCalendarEvent()).toBeNull();
    
    });

    it('should successfully produce the calendar file', async () => {
        const email: Email = new Email();
        email.construct(index.getChanges());
        expect(email['ics']).not.toBeNull();
        expect(email['ics']!.value!.startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(email['ics']!.value!.endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('should successfully merge sales on the same date into a "bulk" sale', async () => {
        const email: Email = new Email();
        email.construct(index.getChanges());
        expect(email['ics']!.value!.includes('Chelsea (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.includes('Brighton and Hove Albion (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.includes('Aston Villa (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : Memb\s*ers Sale \(13\+\)/gis)).not.toBeNull();
        expect(email['ics']!.value!.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : Memb\s*ers Sale \(4\+\)/gis)).not.toBeNull();
    });

    it('should successfully merge absolute duplicates', async () => {
        const email: Email = new Email();
        const backup1: Backup = new Backup(new Date(), Mocks.events);
        const backup2: Backup = new Backup(new Date(), Mocks.events);
        backup1.merge(backup2);
        email.construct(backup1.getEvents());
        const re: RegExp = /Event Description/;
        const matches: Nullable<RegExpExecArray> = re.exec(email['ics']!.value!);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(1);
    });

    it('should throw errors if it cannot produce the calendar file', async () => {
        const create = jest.spyOn(ICS, 'createEvents');
        create.mockImplementationOnce(() => { return { error: 'Something went wrong', value: null }}); 

        const email: Email = new Email();
        expect(() => email.construct(index.getChanges())).toThrow();
    });

    it('should successfully send the email and return true', async () => {
        const date: string = new Date().getDate() + '/' + (new Date().getMonth()+1) + '/' + new Date().getFullYear();
        const email: Email = new Email();
        email.construct(index.getChanges());
        await expect(email.sendEvents()).resolves.toBe(true);
        const mails = mock.getSentMail();
        expect(mails).not.toBeNull();
        expect(mails.length).toBe(1);
        expect(mails[0].from!.toString().startsWith(Email.FROM_NAME)).toBe(true);
        expect(mails[0].subject).toEqual(Email.SUBJECT_SALES + ' (' + date + ')');
        expect(mails[0].text).toContain(Email.BODY_SALES);
        expect(mails[0].attachments).not.toBeUndefined();
        expect(mails[0].attachments).not.toBeNull();
        expect(mails[0].attachments!.length).toBe(1);
        expect(mails[0].attachments![0].content!.toString().startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(mails[0].attachments![0].content!.toString().endsWith('END:VCALENDAR\r\n')).toBe(true);
    });


    it('should successfully send an error email and return true', async () => {
        const email: Email = new Email();
        await expect(email.sendError('An error message', new Error('Error detail'))).resolves.toBe(true);
        const mails = mock.getSentMail();
        expect(mails).not.toBeNull();
        expect(mails.length).toBe(1);
        expect(mails[0].from!.toString().startsWith(Email.FROM_NAME)).toBe(true);
        expect(mails[0].subject).toEqual(Email.SUBJECT_ERROR);
        expect(mails[0].text).toContain('An error message');
        expect(mails[0].text).toContain('Error detail');
        expect(mails[0].attachments).toBeUndefined();
    });

    it('should successfully handle errors in the email sending process and return false', async () => {
        const email: Email = new Email();
        email.construct(index.getChanges());

        mock.setSuccessResponse('200 OK');
        await expect(email.sendEvents()).resolves.toBe(false);

        mock.reset();
        mock.setShouldFailOnce(true);
        await expect(email.sendEvents()).resolves.toBe(false);
        expect(mock.getSentMail().length).toBe(0);
    });

    it('should successfully drop out of the email process if the host has not been set', async () => {
        const config = jest.spyOn(dotenv, 'config');
        const output: DotenvConfigOutput = {};
        config.mockImplementationOnce(() => { return output; });
        delete process.env.EMAIL_HOST;

        const email: Email = new Email();
        email.construct(index.getChanges());
        await expect(email.sendEvents()).resolves.toBe(false);
        const mails = mock.getSentMail();
        expect(mails.length).toBe(0);
    });

});