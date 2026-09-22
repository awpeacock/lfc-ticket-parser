import {jest} from '@jest/globals';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as ICS from 'ics';

import { GetFormat } from './constants';
import { Fixture, Sale } from './fixtures';

dotenv.config({ debug: false, quiet: true });

const today: Date = new Date();
const month: number = today.getMonth() == 11 ? 1 : today.getMonth() + 2;
const year: number = month == 1 ? today.getFullYear() + 1 :  today.getFullYear();

const bulk: {[format: number]: {[key: string]: Array<ICS.EventAttributes>}} = {
    2024: {
        registration: [
            {
                productId: 'lfctickets/ics',
                title: 'Chelsea (H) : Members Ticket Sale Registration (13+)',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Chelsea (H) : Members Ticket Sale Registration (4+)',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Brighton and Hove Albion (H) : Members Ticket Sale Registration (13+)',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Brighton and Hove Albion (H) : Members Ticket Sale Registration',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Aston Villa (H) : Members Ticket Sale Registration (13+)',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Aston Villa (H) : Members Ticket Sale Registration',
                start: [year, month, 1, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            }
        ],
        sales: [
            {
                productId: 'lfctickets/ics',
                title: 'Chelsea (H) : Members Sale (13+)',
                start: [year, month, 8, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Chelsea (H) : Members Sale (4+)',
                start: [year, month, 9, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Brighton and Hove Albion (H) : Members Sale (13+)',
                start: [year, month, 8, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Brighton and Hove Albion (H) : Members Sale',
                start: [year, month, 9, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Aston Villa (H) : Members Sale (13+)',
                start: [year, month, 8, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Aston Villa (H) : Members Sale',
                start: [year, month, 9, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Manchester City (H) : Members Sale (3+)',
                start: [year, month, 9, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            }      
        ]
    },
    2026: {
        
    }
};

const ams: {[format: number]: {[key: string]: Array<ICS.EventAttributes>}} = {
    2024: {
        registration: [
            {
                productId: 'lfctickets/ics',
                title: 'Manchester City (H) : Additional Members 4+ Sale Registration',
                start: [year, month, 2, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Manchester City (H) : Additional Members 3+ Sale Registration',
                start: [year, month, 2, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Manchester City (H) : Additional Members 2+ Sale Registration',
                start: [year, month, 2, 10, 0],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            }
        ],
        sales: [
            {
                productId: 'lfctickets/ics',
                title: 'Brentford (H) : Additional Members Sale',
                start: [year, month, 10, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            },
            {
                productId: 'lfctickets/ics',
                title: 'Manchester City (H) : Additional Members 4+ Sale',
                start: [year, month, 11, 8, 15],
                duration: { minutes: 60 },
                busyStatus: 'BUSY'
            }        
        ],
    }, 
    2026: {
        registration: [

        ],
        sales: [
            
        ]
    }
};

const away: {[format: number]: Array<ICS.EventAttributes>} = {
    2024: [
        {
        productId: 'lfctickets/ics',
        title: 'AC Milan (A) : ST Holders and Members Sale (1+)',
        start: [year, month, 12, 10, 0],
        duration: { minutes: 60 },
        busyStatus: 'BUSY'
        },
        {
        productId: 'lfctickets/ics',
        title: 'AC Milan (A) : ST Holders and Members Registration',
        start: [year, month, 12, 13, 0],
        duration: { minutes: 60 },
        busyStatus: 'BUSY'
        },
        {
        productId: 'lfctickets/ics',
        title: 'AC Milan (A) : ST Holders and Members Sale',
        start: [year, month, 13, 8, 15],
        duration: { minutes: 60 },
        busyStatus: 'BUSY'
        },
    ],
    2026: [

    ]
};

const expired: {[format: number]: Array<ICS.EventAttributes>} = {
    2024: [
        {
            productId: 'lfctickets/ics',
            title: 'Past Event Description',
            start: [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate() - 2, 15, 30],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        }
    ],
    2026: [

    ]
};

const fixtures: {[format: number]: Array<Fixture>} = {
    2024: [
        new Fixture('/tickets/tickets-availability/liverpool-fc-v-chelsea-19-oct-2024-0530pm-347', 'Chelsea', 'H', 'Premier League', new Date((year + 1) + '-10-19 17:30')),
        new Fixture('/tickets/tickets-availability/liverpool-fc-v-brighton-hove-albion-2-nov-2024-0300pm-345', 'Brighton and Hove Albion', 'H', 'Premier League', new Date((year + 1) + '-10-19 17:30')),
        new Fixture('/tickets/tickets-availability/liverpool-fc-v-aston-villa-9-nov-2024-0300pm-346', 'Aston Villa', 'H', 'Premier League', new Date((year + 1) + '-10-19 17:30')),
        new Fixture('/tickets/tickets-availability/liverpool-fc-v-manchester-city-1-dec-2024-0400pm-348', 'Manchester City', 'H', 'Premier League', new Date((year + 1) + '-10-19 17:30'))
    ],
    2026: [
    ]
};
Reflect.set(fixtures[2024][0], 'sales', [new Sale('Members Sale (13+)', Status.PENDING, new Date(year, month-1, 8, 8, 15)), new Sale('Members Sale (4+)', Status.PENDING, new Date(year, month-1, 8, 8, 15))]);
Reflect.set(fixtures[2024][1], 'sales', [new Sale('Members Sale (13+)', Status.PENDING, new Date(year, month-1, 8, 8, 15)), new Sale('Members Sale', Status.PENDING, new Date(year, month-1, 8, 8, 15))]);
Reflect.set(fixtures[2024][2], 'sales', [new Sale('Members Sale (13+)', Status.PENDING, new Date(year, month-1, 8, 8, 15)), new Sale('Members Sale', Status.PENDING, new Date(year, month-1, 8, 8, 15))]);
Reflect.set(fixtures[2024][3], 'sales', [new Sale('Members Sale (3+)', Status.PENDING, new Date(year, month-1, 8, 8, 15))]);

export const Mocks = {
    
    console: {
        log: jest.spyOn(console, 'log'),
        error: jest.spyOn(console, 'error'),
        debug: jest.spyOn(console, 'debug')
    },
    events: {
        2024: {
            bulk: bulk[2024],
            ams : ams[2024],
            away: away[2024],
            expired: expired[2024]
        },
        2026: {
            bulk: bulk[2026],
            ams : ams[2026],
            away: away[2026],
            expired: expired[2026]
        }
    },
    fixtures: {
        2024: fixtures[2024],
        2026: fixtures[2026]
    }
};
Mocks.console.log.mockImplementation(() => null);
Mocks.console.error.mockImplementation(() => null);
Mocks.console.debug.mockImplementation(() => null);

export default function() {

    const files: {[format: number]: {[key: string]: string}} = {
        2024: {
            index: fs.readFileSync('./src/__mocks__/2024/availability-fixture-list.html', 'utf-8'),
            home: fs.readFileSync('./src/__mocks__/2024/availability-home-active.html', 'utf-8'),
            away: fs.readFileSync('./src/__mocks__/2024/availability-away-active.html', 'utf-8'),
            multiple: fs.readFileSync('./src/__mocks__/2024/availability-home-multiple.html', 'utf-8'),
            bulk1: fs.readFileSync('./src/__mocks__/2024/availability-home-bulk-1.html', 'utf-8'),
            bulk2: fs.readFileSync('./src/__mocks__/2024/availability-home-bulk-2.html', 'utf-8'),
            credits: fs.readFileSync('./src/__mocks__/2024/availability-home-credits.html', 'utf-8'),
            cup: fs.readFileSync('./src/__mocks__/2024/availability-home-cup.html', 'utf-8'),
            subject: fs.readFileSync('./src/__mocks__/2024/availability-away-subject.html', 'utf-8'),
            euro: fs.readFileSync('./src/__mocks__/2024/availability-away-euro.html', 'utf-8'),
            image: fs.readFileSync('./src/__mocks__/2024/availability-away-image.html', 'utf-8'),
            inactive: fs.readFileSync('./src/__mocks__/2024/availability-home-inactive.html', 'utf-8'),
            sold: fs.readFileSync('./src/__mocks__/2024/availability-away-inactive.html', 'utf-8'),
            tbc: fs.readFileSync('./src/__mocks__/2024/availability-away-tbc.html', 'utf-8')
        },
        2026: {
            index: fs.readFileSync('./src/__mocks__/2026/availability-fixture-list.html', 'utf-8'),
            home: fs.readFileSync('./src/__mocks__/2026/availability-home-active.html', 'utf-8'),
            away: fs.readFileSync('./src/__mocks__/2026/availability-away-active.html', 'utf-8'),
            credits: fs.readFileSync('./src/__mocks__/2026/availability-home-credits.html', 'utf-8'),
            subject: fs.readFileSync('./src/__mocks__/2026/availability-away-subject.html', 'utf-8'),
            euro: fs.readFileSync('./src/__mocks__/2026/availability-away-euro.html', 'utf-8'),
            inactive: fs.readFileSync('./src/__mocks__/2026/availability-home-inactive.html', 'utf-8')
        }
    };

    global.fetch = jest.fn((input: RequestInfo | URL) => {
        const year: number = GetFormat();
        const url: string = (input as URL).toString();
        let html: string = '';
        if ( url.endsWith('tickets-availability') || url.endsWith('tickets?category=mens') ) {
            html = files[year].index;
        } else if ( url.includes('brentford') ) {
            html = (year == 2024) ? files[2024].home : files[2026].away;
        } else if ( url.includes('chelsea') ) {
            html = files[2024].multiple;
        } else if ( url.includes('brighton') && url.includes('2024') ) {
            html = files[2024].bulk1;
        } else if ( url.includes('aston-villa') ) {
            html = files[2024].bulk2;
        } else if ( url.includes('manchester-city') ) {
            html = files[year].credits;
        } else if ( url.includes('brighton') && url.includes('2026') ) {
            if ( url.includes('premier-league') ) {
                html = files[2026].inactive;
            } else {
                html = files[2024].cup;
            }
        } else if ( url.includes('wolverhampton-wanderers') ) {
            html = files[2024].away;
        } else if ( url.includes('manchester-utd') ) {
            html = files[2024].subject;
        } else if ( url.includes('ac-milan') ) {
            html = files[2024].euro;
        } else if ( url.includes('west-ham') ) {
            html = files[2024].image
        } else if ( url.includes('-v-nottingham-forest') ) {
            html = (year == 2024) ? files[2024].inactive : files[2026].home;
        } else if ( url.includes('manchester-united') ) {
            html = files[2024].sold;
        } else if ( url.includes('nottingham-forest-v-') ) {
            html = files[2024].tbc;
        } else if ( url.includes('newcastle') ) {
            html = files[2026].subject;
        } else if ( url.includes('lask') ) {
            html = files[2026].euro;
        }
        return Promise.resolve({
            text: () => Promise.resolve(html)
        })
    }) as jest.Mock<typeof fetch>;  

};