import React, { Suspense } from 'react';
import { withTranslation } from 'react-i18next';
import Fetch from './Fetch';
import aircs from './aircs.svg';
import './App.css';

import Leaderboard from './Leaderboard';
import Players from './Players';
import Stations from './Stations';
import NotificationDrawer from './NotificationDrawer';
import Wsh from './wsh';
import Ticker from './ticker';
import Settings from './Settings';

class App extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      currentView: "leaderboard",
      state: "load",
      selectPlayer: null,
      playerData: {},
      stationData: {},
      recentEvents: []
    };
  }

  componentDidMount() {
    //Set up the WS connection
    let ws = new Wsh(`ws://${window.location.host}/ws`);
    ws.on("message", async (data) => {
      switch (data.type) {
        case "newPlayer":
          this.setState(state => {
            let pdata = JSON.parse(JSON.stringify(state.playerData));
            pdata[data.user] = {
              "uuid": data.uuid,
              "visited": [],
              "place": -1
            };

            return {
              playerData: pdata
            }
          })
          break;
        case "removePlayer":
          this.setState(state => {
            let pdata = JSON.parse(JSON.stringify(state.playerData));
            delete pdata[data.user];
            
            return {
              playerData: pdata
            }
          })
          break;
        case "visitation":
          this.setState(state => {
            let pdata = JSON.parse(JSON.stringify(state.playerData));
            pdata[data.user].visited.push(data.station);
            
            return {
              playerData: pdata
            }
          });
          break;
        case "completion":
          this.setState(state => {
            let pdata = JSON.parse(JSON.stringify(state.playerData));
            pdata[data.username].place = data.place;
            
            return {
              playerData: pdata
            }
          });
          break;
        case "stationChange":
          await Promise.all([
            await this.updatePlayers(),
            await this.updateStations()
          ]);
      }
    });
    ws.on("open", () => {
      this.setState({
        state: "ready"
      });
    })
    ws.on("close", () => {
      this.setState({
        state: "error"
      });
    })

    this.setState({
      ws: ws
    });

    (async () => {
      await Promise.all([
        await this.updatePlayers(),
        await this.updateStations()
      ])
    })();
  }

  async updatePlayers() {
    this.setState({
      playerData: await Fetch.get("/users")
    });
  }

  async updateStations() {
    this.setState({
      stationData: await Fetch.get("/stations")
    })
  }

  componentWillUnmount() {
    try {
      if (this.state.ws) this.state.ws.close();
    } catch {

    }
  }

  renderMainView() {
    switch (this.state.currentView) {
      case "leaderboard":
        return <Leaderboard stationData={this.state.stationData} playerData={this.state.playerData} recentEvents={this.state.recentEvents} onPlayerClicked={this.playerClicked.bind(this)}/>
      case "players":
        return <Players stationData={this.state.stationData} playerData={this.state.playerData} selectPlayer={this.state.selectPlayer} />
      case "stations":
        return <Stations stationData={this.state.stationData} playerData={this.state.playerData} onPlayerClicked={this.playerClicked.bind(this)} />
      case "settings":
        return <Settings onLocaleChange={this.onLocaleChange.bind(this)} />
      case "aircsmap":
        return <iframe src="https://thepixelpolygon.github.io/aircsnetmap" style={{flexGrow: 1, border: "none"}}/>
    }
  }

  onLocaleChange() {
    this.updateStations();
  }

  playerClicked(player) {
    this.setState({
      currentView: "players",
      selectPlayer: player
    });
  }

  changeView(view) {
    this.setState({
      selectPlayer: null,
      currentView: view
    });
  }

  notificationPosted(notification) {
    this.setState(state => {
      return {
        recentEvents: [...state.recentEvents, notification]
      }
    });
  }

  renderState() {
    switch (this.state.state) {
      case "load":
        return <div className="errorContainer">
          <h1>{this.props.t("APP_LOADING")}</h1>
          <p>{this.props.t("APP_PLEASE_WAIT")}</p>
        </div>
      case "ready":
        return <>
        <Ticker websocket={this.state.ws} />
          {this.renderMainView()}
          <div className="header">
            <div className="headerButtons">
              <div className={`headerButton ${this.state.currentView == "leaderboard" && "selected"}`} onClick={this.changeView.bind(this, "leaderboard")}>{this.props.t("APP_LEADERBOARD")}</div>
              <div className={`headerButton ${this.state.currentView == "stations" && "selected"}`} onClick={this.changeView.bind(this, "stations")}>{this.props.t("APP_STATIONS")}</div>
              <div className={`headerButton ${this.state.currentView == "players" && "selected"}`} onClick={this.changeView.bind(this, "players")}>{this.props.t("APP_PLAYERS")}</div>
              <div className={`headerButton ${this.state.currentView == "aircsmap" && "selected"}`} onClick={this.changeView.bind(this, "aircsmap")}>{this.props.t("APP_AIRCS_MAP")}</div>
              <div className={`headerButton ${this.state.currentView == "settings" && "selected"}`} onClick={this.changeView.bind(this, "settings")}>{this.props.t("APP_SETTINGS")}</div>
            </div>
            <img src={aircs} style={{height: "100%", padding: "9px", boxSizing: "border-box"}}></img>
          </div>
          <NotificationDrawer stationData={this.state.stationData} websocket={this.state.ws} onNotification={this.notificationPosted.bind(this)} />
        </>
        case "error":
          return <div className="errorContainer">
            <h1>{this.props.t("APP_DISCONNECTED")}</h1>
            <p>{this.props.t("APP_PLEASE_RELOAD")}</p>
          </div>
    }
  }

  render() {
    return <div className="mainContainer">
        {this.renderState()}
      </div>
  }
}

const AppT = withTranslation()(App);

class AppContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false
    }
  }

  render() {
    return this.state.hasError ? 
        <div className="errorContainer">
        <h1>Ouch!</h1>
        <p>That hurt :(</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div> : <Suspense fallback={
        <div className="errorContainer">
          <h1>Loading...</h1>
          <p>Please wait a second.</p>
        </div>
      }><AppT /></Suspense>
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }
}

export default AppContainer;
