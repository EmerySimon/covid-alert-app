import BackgroundFetch from 'react-native-background-fetch';
import {Platform} from 'react-native';
import {TEST_MODE} from 'env';
import {captureMessage, captureException} from 'shared/log';
import {PollNotifications} from 'services/PollNotificationService';

const BACKGROUND_TASK_ID = 'app.covidshield.exposure-notification';

interface PeriodicTask {
  (): Promise<void>;
}

// See https://github.com/cds-snc/covid-shield-mobile/issues/642#issuecomment-657783192
const DEFERRED_JOB_INTERNVAL_IN_MINUTES = 240;
const EXACT_JOB_INTERNVAL_IN_MINUTES = 90;

const registerPeriodicTask = async (task: PeriodicTask, bgTaskId = BACKGROUND_TASK_ID) => {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: TEST_MODE ? EXACT_JOB_INTERNVAL_IN_MINUTES : DEFERRED_JOB_INTERNVAL_IN_MINUTES,
      forceAlarmManager: TEST_MODE,
      enableHeadless: true,
      startOnBoot: true,
      stopOnTerminate: false,
    },
    async taskId => {
      switch (taskId) {
        case 'app.covidshield.poll-notifications':
          captureMessage('>>>>> Received POLL NOTIFICATIONS TASK');
          try {
            PollNotifications.checkForNotifications();
          } catch (error) {
            captureException('pollNotificationsException', error);
          }
          break;
        default:
          captureMessage('>>>>> Default TASK RUN');
          captureMessage('runPeriodicTask', {taskId});
          try {
            await task();
          } catch (error) {
            captureException('runPeriodicTask', error);
          }
          BackgroundFetch.finish(taskId);
      }
    },
  );
  const result = await BackgroundFetch.scheduleTask({taskId: bgTaskId, delay: 0, periodic: true}).catch(() => false);
  captureMessage('registerPeriodicTask', {result});

  const pnResult = await BackgroundFetch.scheduleTask({
    taskId: 'app.covidshield.poll-notifications',
    delay: 0,
    periodic: true,
  }).catch(() => false);

  captureMessage('registerPollTask', {pnResult});
};

const registerAndroidHeadlessPeriodicTask = (task: PeriodicTask) => {
  if (Platform.OS !== 'android') {
    return;
  }
  BackgroundFetch.registerHeadlessTask(async ({taskId}) => {
    captureMessage('runAndroidHeadlessPeriodicTask', {taskId});
    try {
      await task();
    } catch (error) {
      captureException('runAndroidHeadlessPeriodicTask', error);
    }
    BackgroundFetch.finish(taskId);
  });
  captureMessage('registerAndroidHeadlessPeriodicTask');
};

export const BackgroundScheduler = {
  registerPeriodicTask,
  registerAndroidHeadlessPeriodicTask,
};
