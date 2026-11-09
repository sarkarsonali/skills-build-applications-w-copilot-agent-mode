import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Activity details are required'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' || !mongoose.isObjectIdOrHexString(userId) ||
    typeof teamId !== 'string' || !mongoose.isObjectIdOrHexString(teamId) ||
    typeof type !== 'string' || !type.trim() ||
    typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 1
  ) {
    throw Object.assign(new Error('Valid userId, teamId, type, and minutes are required'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(userId).select('_id'),
    Team.findById(teamId).select('_id'),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('The activity user or team does not exist'), { status: 404 });
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Team details are required'), { status: 400 });
  }

  const { name, mascot, members = [] } = input as Record<string, unknown>;
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof mascot !== 'string' || !mascot.trim() ||
    !Array.isArray(members) ||
    !members.every((member): member is string => typeof member === 'string' && mongoose.isObjectIdOrHexString(member))
  ) {
    throw Object.assign(new Error('Valid name, mascot, and member IDs are required'), { status: 400 });
  }

  const memberIds = [...new Set(members)];
  if (memberIds.length > 0) {
    const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id');
    if (existingMembers.length !== memberIds.length) {
      throw Object.assign(new Error('One or more team members do not exist'), { status: 404 });
    }
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const [teams, activities] = await Promise.all([
    Team.find().select('_id name').lean(),
    Activity.find().select('team points').lean(),
  ]);
  const pointsByTeam = new Map<string, number>();

  for (const activity of activities) {
    const teamId = activity.team?.toString();
    if (teamId) {
      pointsByTeam.set(teamId, (pointsByTeam.get(teamId) ?? 0) + (activity.points ?? 0));
    }
  }

  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function focusForActivity(type: string) {
  const normalizedType = type.toLowerCase();
  if (['run', 'cycle', 'walk'].includes(normalizedType)) return 'endurance';
  if (['strength', 'weights'].includes(normalizedType)) return 'strength';
  if (['yoga', 'stretch'].includes(normalizedType)) return 'mobility';
  return normalizedType;
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const [recentActivities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(5).select('type').lean(),
    Workout.find().lean(),
  ]);
  const preferredFocuses = [...new Set([
    user.fitnessGoal.toLowerCase(),
    ...recentActivities.map(({ type }) => focusForActivity(type)),
  ])];
  const matchingWorkouts = workouts.filter((workout) => preferredFocuses.includes(workout.focus.toLowerCase()));
  const candidates = matchingWorkouts.length > 0 ? matchingWorkouts : workouts;

  return candidates
    .sort((left, right) => preferredFocuses.indexOf(left.focus.toLowerCase()) - preferredFocuses.indexOf(right.focus.toLowerCase()))
    .map((workout) => {
      const recentActivity = recentActivities.find((activity) => focusForActivity(activity.type) === workout.focus.toLowerCase());
      const matchesGoal = workout.focus.toLowerCase() === user.fitnessGoal.toLowerCase();
      const reason = matchesGoal && recentActivity
        ? `Matches your ${user.fitnessGoal} goal and builds on your recent ${recentActivity.type} activity.`
        : matchesGoal
          ? `Matches your ${user.fitnessGoal} fitness goal.`
          : recentActivity
            ? `Builds on your recent ${recentActivity.type} activity.`
            : `Recommended based on your ${user.fitnessGoal} fitness goal.`;
      return { ...workout, reason };
    });
}

export { User };
