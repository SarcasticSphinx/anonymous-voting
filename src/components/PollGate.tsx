import { getPollForVoting, getResults, hasIpVoted } from "@/lib/db";
import { deviceVotedEpoch, getIpHash } from "@/lib/voter";
import VoteFlow from "./VoteFlow";
import Leaderboard from "./Leaderboard";
import Message from "./Message";

/**
 * Decides what a visitor sees for a poll:
 *  - the ballot, if voting is open and they have not voted yet
 *  - otherwise the leaderboard (if public), or a short message
 */
export default async function PollGate({ pollId }: { pollId: string }) {
  const poll = await getPollForVoting(pollId).catch(() => null);
  if (!poll) {
    return <Message title="Poll not found" body="This link may be wrong or the poll was removed." />;
  }

  let reason: string | null = null;
  if (poll.status !== "open") {
    reason = "Voting has closed for this poll.";
  } else {
    const [deviceEpoch, ipUsed] = await Promise.all([
      deviceVotedEpoch(poll.id),
      poll.one_per_ip ? getIpHash(poll.id).then((h) => hasIpVoted(poll.id, h)) : false,
    ]);
    if (deviceEpoch === poll.epoch) reason = "You have already voted in this poll.";
    else if (ipUsed) reason = "A vote has already been cast from this network.";
  }

  if (!reason) {
    return (
      <VoteFlow
        poll={{
          id: poll.id,
          title: poll.title,
          requireCode: poll.require_code,
          candidates: poll.candidates,
        }}
      />
    );
  }

  if (!poll.results_public) {
    return <Message title={poll.title} body={`${reason} Results will be shown when the organiser reveals them.`} />;
  }

  const results = await getResults(poll.id);
  if (!results) return <Message title="Poll not found" body="This poll was removed." />;
  return <Leaderboard initial={results} note={reason} />;
}
