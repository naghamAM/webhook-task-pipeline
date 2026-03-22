type Job = {
  id: string;
  payload: any;
};

const queue: Job[] = [];

export function addJob(job: Job) {
  queue.push(job);
}

export function getNextJob(): Job | undefined {
  return queue.shift();
}
