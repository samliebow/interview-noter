import React, { Component } from 'react';
import moment from 'moment';
import Notes from './Notes';
import Prompt from './Prompt';
import Setup from './Setup';
import apiKey from '../../apiKey.js';

class App extends Component {
  state = {
    loggedIn: null,
    startTime: '',
    candidateName: '',
    candidateEmail: '',
    rooms: {
      tlkio: '',
      codestitch: '',
      zoom: ''
    },
    promptUrl: '',
    promptButtonsShown: true,
  };

  componentDidMount() {
    gapi.load('client:auth2', async () => {
      const scopes = [
        'https://www.googleapis.com/auth/calendar', 
        'https://www.googleapis.com/auth/drive',
        ];
      await gapi.client.init({
        apiKey,
        // discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        clientId: '695004460995-m8hbtlfkktf3d6opnafeer5j0dsbmn72.apps.googleusercontent.com',
        scope: scopes.join(' '),
      });
      this.GoogleAuth = gapi.auth2.getAuthInstance();
      this.GoogleAuth.isSignedIn.listen(this.handleLogin);
      this.GoogleAuth.isSignedIn.get() ?
        this.handleLogin() :
        this.GoogleAuth.signIn();
    });
  }

  copyPrompt = async event => {
    this.setState({ promptButtonsShown: false });
    const promptName = event.target.id;
    const promptId = {
      'Version Control': '1tTkmIotuBEP8PwvpxmTaTHKDDUCb8i0ikmTfm8D8oA4',
      'MRP': '196ClAKfTFgO8gWs3O57QGcddVnWiS9RNtAXpVuEcrxU',
      'Book Library': '1dDybGPnNcNr3kE9rJMB-_MmQAtFCTujCFauD0KrPNfY',
    }[promptName];
    const copyMetadata = await gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${promptId}/copy`,
      method: 'POST',
      body: {
        name: `${this.state.candidateName} - ${moment().format('YYYY-MM-DD')} - ${promptName}`,
        parents: ['root'],
      },
    });
    const copyId = copyMetadata.result.id;
    const publishPromise = gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${copyId}/revisions/1`,
      method: 'PATCH',
      body: { 
        published: true,
        publishAuto: true,
        publishedOutsideDomain: true,
      },
    });
    const editPromise = gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${copyId}/permissions`,
      method: 'POST',
      body: {
        role: 'writer',
        type: 'anyone',
        allowFileDiscovery: false,
      },
    });
    await Promise.all([publishPromise, editPromise]);
    const promptUrl = `https://docs.google.com/document/d/${copyId}/edit?usp=sharing`;
    this.setState({ promptUrl });
  };

  getCalendarData = async () => {
    const {result: { items: calendars } } = await gapi.client.request({
      path: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    });
    // Get logged-in user's name from the email on their primary calendar.
    // We could get this from the HIR calendar too, but it might be out-of-date
    // if they just inherited the calendar from the HIR they're replacing.
    const loggedIn = calendars.filter(calendar => calendar.primary)[0].id
      // formatting from e.g. 'samuel.liebow@hackreactor.com' to 'Samuel Liebow'
      .split('@')[0].split('.').map(name => name[0].toUpperCase() + name.slice(1))[0];
    this.setState({ loggedIn });

    const hirCalendarId = calendars.filter(
      ({ summary }) => summary.includes('HiR'))[0].id;
    const {result: {items: [interview] } } = await gapi.client.request({
      path: `https://www.googleapis.com/calendar/v3/calendars/${hirCalendarId}/events`,
      params: {
        singleEvents: true,
        orderBy: 'startTime',
        q: '#Interview Online with',
        timeMin: moment().subtract(10, 'minutes').toISOString(),
      },
    });
    const { description, start } = interview;
    const soonestInterviewDetails = description.split('\n').slice(0, 3);
    const [candidateName, candidateEmail, tlkioLink] = soonestInterviewDetails.map(el => el.split(': ')[1]);
    const startTime = moment(start);
    this.setState({
      startTime,
      candidateName,
      candidateEmail,
      rooms: Object.assign({}, this.state.rooms, { tlkio: tlkioLink }),
    });
  };

  handleLogin = (loggingIn = true) => {
    if (!loggingIn) {
      window.location.reload();
    } else {
      this.setState({ loggedIn: true, });
      this.getCalendarData();
    }
  }


  render() {
    const { 
      loggedIn,
      startTime,
      candidateName,
      candidateEmail,
      rooms,
      promptUrl,
      promptButtonsShown,
    } =  this.state;
    return (
      <div className="app" style={{ padding: '2em', height: 'calc(100vh - 4em)' }}>
        <h1
          style={{
            fontSize: 24,
            margin: '0 0 .5em 0',
            padding: 0
          }}
        >
          HR Interview Noter
        </h1>

        <Setup
          loggedIn={loggedIn}
          logout={this.GoogleAuth && this.GoogleAuth.disconnect.bind(this.GoogleAuth)}
          startTime={startTime}
          candidateName={candidateName}
          candidateEmail={candidateEmail}
          rooms={rooms}
        />

        <Prompt 
          copyPrompt={this.copyPrompt}
          promptUrl={promptUrl}
          promptButtonsShown={promptButtonsShown}
        />

        <Notes />
      </div>
    );
  }
};

export default App;
