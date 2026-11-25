import { getPollForVoting, getResults } from "@/lib/db";
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
  // One database round trip for the poll, its names and the network check.
  const [ipHash, deviceEpoch] = await Promise.all([getIpHash(pollId), deviceVotedEpoch(pollId)]);
  const poll = await getPollForVoting(pollId, ipHash).catch(() => null);
  if (!poll) {
    return <Message title="Poll not found" body="This link may be wrong or the poll was removed." />;
  }

  let reason: string | null = null;
  if (poll.status !== "open") {
    reason = "Voting has closed for this poll.";
  } else {
    if (deviceEpoch === poll.epoch) reason = "You have already voted in this poll.";
    else if (poll.one_per_ip && poll.ipUsed) reason = "A vote has already been cast from this network.";
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
