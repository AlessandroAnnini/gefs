export const baseUrl =
  'https://modeles3.meteociel.fr/modeles/gens/ecmwf/graphe_ens3_04.php?';

export const mode: IMode[] = [
  { value: '0', label: 'Normal' },
  { value: '1', label: 'Box' },
];

export const scales: IScale[] = [
  { value: '0', label: 'ST' },
  { value: '1', label: 'DYN' },
];

export const graphs: IGraph[] = [
  { value: '0', label: 'TT850 T500 RR' },
  { value: '1', label: 'Pressure' },
  // { value: '2', label: 'Temp 2m' },
  { value: '3', label: 'TZ500' },
  { value: '4', label: 'Cumul RR' },
];

// export const durations: IDuration[] = [
//   { value: '0', label: '0-192' },
//   { value: '1', label: '0-384' },
//   { value: '2', label: '0-192 (3h)' },
// ];

export const colors: IColor[] = [
  { value: '0', label: 'white' },
  { value: '1', label: 'black' },
];
