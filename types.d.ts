// navigator

type RootStackParamList = {
  Main: undefined;
  Map: undefined;
};

// screens

interface Settings {
  onRequestMap: () => void;
}

// constants

interface IMode {
  value: string;
  label: string;
}

interface IScale {
  value: string;
  label: string;
}

interface IGraph {
  value: string;
  label: string;
}

interface IDuration {
  value: string;
  label: string;
}

interface IColor {
  value: string;
  label: string;
}

// stores

interface LocationState {
  latitude: number;
  longitude: number;
  changeLocation: (location: MyLocation) => void;
}

interface SettingsState {
  mode: string;
  scale: string;
  graph: string;
  // duration: string;
  // isMulti: boolean;
  color: string;
  isLocationFromMap: boolean;
  time: number;
  isSearchingCoords: boolean;
  changeMode: (dmode: string) => void;
  toggleMode: () => void;
  changeScale: (scale: string) => void;
  changeGraph: (graph: string) => void;
  // changeDuration: (duration: string) => void;
  // changeIsMulti: (isMulti: boolean) => void;
  changeColor: (color: string) => void;
  toggleColor: () => void;
  changeIsLocationFromMap: (isLocationFromMap: boolean) => void;
  updateTime: () => void;
  changeIsSearchingCoords: (isSearchingCoords: boolean) => void;
}
