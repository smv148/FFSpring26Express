var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var hbs = require('hbs');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

const dataDirectory = path.join(__dirname, 'data');
const storage = path.join(dataDirectory, 'database.sqlite');
fs.mkdirSync(dataDirectory, { recursive: true });

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false
});

const Activity = sequelize.define('Activity', {
  type: { type: DataTypes.STRING, allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  intensity: { type: DataTypes.STRING },
  mood: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  date: { type: DataTypes.DATEONLY, allowNull: false }
});

sequelize.sync().catch(console.error);

function calculateStreak(activities) {
  if (activities.length === 0) return 0;

  const dates = [...new Set(activities.map(a => a.date))].sort().reverse();
  let streak = 0;
  let current = new Date();

  for (let date of dates) {
    const activityDate = new Date(date);
    const diffDays = Math.floor((current - activityDate) / (1000 * 60 * 60 * 24));

    if (diffDays === streak || diffDays === streak + 1) {
      streak++;
      current = activityDate;
    } else {
      break;
    }
  }

  return streak;
}

app.get('/', async function(req, res, next) {
  try {
    const activities = await Activity.findAll({ order: [['date', 'DESC']] });

    const totalMinutes = activities.reduce((sum, item) => sum + item.duration, 0);
    const totalActivities = activities.length;
    const streak = calculateStreak(activities);

    const activityTypes = {};
    activities.forEach(item => {
      activityTypes[item.type] = (activityTypes[item.type] || 0) + item.duration;
    });

    const chartLabels = Object.keys(activityTypes);
    const chartData = Object.values(activityTypes);

    res.render('index', {
      title: 'Move Your Way',
      totalMinutes,
      totalActivities,
      streak,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData),
      recentActivities: activities.slice(0, 5)
    });
  } catch (err) {
    next(err);
  }
});

app.get('/addactivity', function(req, res) {
  res.render('addactivity', { title: 'Add Activity' });
});

app.post('/addactivity', async function(req, res, next) {
  try {
    await Activity.create({
      type: req.body.type,
      duration: req.body.duration,
      intensity: req.body.intensity,
      mood: req.body.mood,
      notes: req.body.notes,
      date: req.body.date
    });

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.get('/history', async function(req, res, next) {
  try {
    const activities = await Activity.findAll({ order: [['date', 'DESC']] });
    res.render('history', {
      title: 'Activity History',
      activities
    });
  } catch (err) {
    next(err);
  }
});

app.get('/about', function(req, res) {
  res.render('about', { title: 'About Move Your Way' });
});

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;