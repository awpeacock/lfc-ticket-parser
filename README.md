# LFC Ticket Parser

Utility to read in the [**Liverpool Football Club** Tickets Availability](https://www.liverpoolfc.com/tickets/tickets-availability) page, retrieve sales dates for fixtures and email them out in [iCalendar](https://icalendar.org/) format.

_Please note: this does not parse ambulatory or hospitality seating, and will not return any currently active sales (that ship has sailed)._

## Usage

Before running the parse, you will need to configure it using environment variables.

### Example .env file

The following properties tell the parser where to retrieve the index page from, and the domain will be used for all the relative links representing the inidividual fixture pages:

```properties
DOMAIN=https://www.liverpoolfc.com
INDEX_URL=/tickets/tickets-availability
```

The parser will attempt to email the generated ICS file via SMTP after processing, and these properties are required in order for it to be able to do so (`EMAIL_PORT` and `EMAIL_SECURE` can be amended if you wish to communicate with your mail server insecurely).  If `EMAIL_ERROR` is not supplied, then the value supplied for `EMAIL_TO` will be used for all error alerts.

```properties
EMAIL_HOST=<SMTP Server Hostname>
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=<SMTP Account Username>
EMAIL_PASS=<SMTP Account Password>
EMAIL_FROM=<SMTP Account Email Address>
EMAIL_TO=<Recipient Email Address>
EMAIL_ERROR=<Email Address for Error Alerts>
```

In order for the parser to determine whether fixture details have changed, it needs to store details somewhere to refer back to.  Presently, the only database supported is [AWS DynamoDB](https://aws.amazon.com/dynamodb/), and you will need the following properties to communicate with it:

```properties
DB_CLIENT=DynamoDB
DB_TABLE=<Table Name>
DB_BACKUP=<Backup Table Name>
```

The following properties are only needed if you run the parser remotely from where the database is hosted:

```properties
AWS_ACCESS_KEY_ID=<IAM User Access Key>
AWS_SECRET_ACCESS_KEY=<IAM User Secret Access Key>
AWS_REGION=<Region DB is Hosted>
```

If no database is configured, the parser will not fail, it will still parse the website and send out the email but it will send out all fixture details every time.

Finally, setting the following property to any value will add additional debugging logging to the parser's output.

```properties
DEBUG=true
```

### Running locally

Once configured, to run it locally from within a [Node](https://nodejs.org/en) environment, you only need to run the following command:

```bash
npm start
```

### Running as an AWS Lambda

If you wish to run it as an [AWS Lambda](https://aws.amazon.com/lambda/) service, then you need to follow these steps:

1. Compile the Javascript code - this will create a zip file `lfct-aws-js.zip` in the `outputs` folder (creating that folder if it doesn't already exist):
```bash
npm run build:aws
```
2. Create your new Lambda service.
3. In the content editor, upload the newly created zip file.
4. Be sure to setup the environment variables above, within *Configuration* > *Environment Variables*.

You can then run this [Lambda](https://aws.amazon.com/lambda/) through whichever method you choose (for example, an [EventBridge](https://aws.amazon.com/eventbridge/) schedule).

## Future Plans

If time permits, I may add more configuration to allow you to restrict which fixtures it returns (e.g. do not parse away fixtures, fixtures that require _x_ credits, etc.)