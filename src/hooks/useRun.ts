import getHours from 'date-fns/getHours';
import getMinutes from 'date-fns/getMinutes';

export const useRun = () => {
  const currentHours = getHours(new Date());
  const currentMinutes = getMinutes(new Date());
  const minToday = currentHours * 60 + currentMinutes;

  let run;
  // 0.00 - 1.30 -> 18
  if (minToday >= 0 && minToday <= 90) run = '12';
  // 1.31 - 7.30 -> 0
  if (minToday > 90 && minToday <= 450) run = '18';
  // 7.31 - 13.30 -> 6
  if (minToday > 450 && minToday <= 811) run = '0';
  // 13.31 - 19.30 -> 12
  if (minToday > 811 && minToday <= 1170) run = '6';
  // 19.31 - 0.00 -> 18
  if (minToday > 1170) run = '12';

  return run;
};
