const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const methodOverride = require("method-override");
const marked = require("marked");
const createDomPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const dompurify = createDomPurify(new JSDOM().window);
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const MongoStore = require("connect-mongo");
const axios = require("axios");

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride("_method"));

//---------DB connection---------
mongoose.connect(process.env.ATLAS_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("connected");
});

const sessionStore = MongoStore.create({
    mongoUrl: process.env.ATLAS_URI,
    collectionName: 'sessions'
});

//--------Session setup----------
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  })
);

//--------Initialize passport------
app.use(passport.initialize());

//--------Use Passport to deal with sessions--------
app.use(passport.session());

//--------Post Schema--------
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  markdown: String,
  account: String,
  email: String,
  authorId: String,
  timestamp: String,
  likes: Number,
  sanitizedHtml: {
    type: String,
    required: true,
  },
});

postSchema.pre("validate", function (next) {
  if (this.markdown) {
    this.sanitizedHtml = dompurify.sanitize(marked(this.markdown));
  }
  next();
});
const Post = mongoose.model("Post", postSchema);

//--------User Schema--------
const userSchema = new mongoose.Schema({
  userHandle: String,
  password: String,
  googleId: String,
  posts: [postSchema],
  likedPosts: [String],
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        {
          googleId: profile.id,
          userHandle: profile.displayName,
          username: profile.emails[0]["value"],
          isVerified: true, // Google users are considered verified
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

//-----------Routes requests-----------

//get Home
app.get("/", async (req, res) => {

    let trendingArticles = [];
    try {
        const response = await axios.get('https://dev.to/api/articles', {
            params: {
                tag: 'technology',
                top: 7, // top articles from the last 7 days
                per_page: 5
            }
        });
        trendingArticles = response.data;
    } catch (error) {
        console.error("Error fetching trending articles:", error.message);
        // trendingArticles will remain an empty array, so the page won't crash
    }

  Post.find((err, posts) => {
    posts.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    if (req.isAuthenticated()) {
      User.findById(req.user.id, (err, foundUser) => {
        if (err || !foundUser) {
          console.log(err);
          // Render the page even if user lookup fails but provide empty liked posts
          return res.render("home", {
            pageTitle: "Recent Posts",
            newPost: posts,
            authenticated: req.isAuthenticated(),
            user: req.user,
            userLikedPosts: [],
            trendingArticles: trendingArticles
          });
        }
        res.render("home", {
          pageTitle: "Recent Posts",
          newPost: posts,
          authenticated: req.isAuthenticated(),
          user: req.user,
          userLikedPosts: foundUser.likedPosts,
          trendingArticles: trendingArticles
        });
      });
    } else {
      res.render("home", {
        pageTitle: "Recent Posts",
        newPost: posts,
        authenticated: req.isAuthenticated(),
        user: null,
        userLikedPosts: null,
        trendingArticles: trendingArticles
      });
    }
  });
});

//get Search
app.get("/search", async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.redirect("/");
    }

    let trendingArticles = [];
    try {
        const response = await axios.get('https://dev.to/api/articles', {
            params: {
                tag: 'technology',
                top: 7,
                per_page: 5
            }
        });
        trendingArticles = response.data;
    } catch (error) {
        console.error("Error fetching trending articles:", error.message);
    }

    const regex = new RegExp(query, 'i'); // 'i' for case-insensitive

    Post.find({ $or: [{ title: regex }, { content: regex }] }, (err, posts) => {
        if(err){
            console.log(err);
            return res.redirect("/");
        }

        posts.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        if (req.isAuthenticated()) {
            User.findById(req.user.id, (err, foundUser) => {
                if (err || !foundUser) {
                    return res.render("home", {
                        pageTitle: `Search Results for "${query}"`,
                        newPost: posts,
                        authenticated: req.isAuthenticated(),
                        user: req.user,
                        userLikedPosts: null,
                        trendingArticles: trendingArticles
                    });
                }
                res.render("home", {
                    pageTitle: `Search Results for "${query}"`,
                    newPost: posts,
                    authenticated: req.isAuthenticated(),
                    user: req.user,
                    userLikedPosts: foundUser.likedPosts,
                    trendingArticles: trendingArticles
                });
            });
        } else {
            res.render("home", {
                pageTitle: `Search Results for "${query}"`,
                newPost: posts,
                authenticated: req.isAuthenticated(),
                user: null,
                userLikedPosts: null,
                trendingArticles: trendingArticles
            });
        }
    });
});

//Google Oauth
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/signin",
    successRedirect: "/",
  })
);

//get SignIn
app.get("/signin", function (req, res) {
  res.render("signin", { authenticated: req.isAuthenticated(), message: null, user: req.user });
});

//get SignUp
app.get("/signup", function (req, res) {
  res.render("signup", { authenticated: req.isAuthenticated(), message: null, user: req.user });
});

//post SignUp
app.post("/signup", (req, res) => {
    User.findOne({
        $or: [
            { username: req.body.username },
            { userHandle: req.body.userhandle }
        ]
    }, (err, existingUser) => {
        if (err) {
            console.log(err);
            return res.render("signup", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'An error occurred. Please try again.'}, user: req.user });
        }
        
        if (existingUser) {
            let messageText = '';
            if (existingUser.username === req.body.username) {
                messageText = 'An account with this email already exists.';
            } else {
                messageText = 'This username is already taken. Please choose another one.';
            }
            return res.render("signup", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: messageText}, user: req.user });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const newUser = new User({
            username: req.body.username,
            userHandle: req.body.userhandle,
            isVerified: false,
            verificationToken: token,
            verificationTokenExpires: Date.now() + 3600000, // 1 hour
        });

        User.register(newUser, req.body.password, (err, user) => {
            if (err) {
                console.log(err);
                return res.render("signup", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'Could not register user. Please try again.'}, user: req.user });
            }

            // Send verification email
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: `"BLOGGY" <${process.env.EMAIL_USER}>`,
                to: user.username,
                subject: 'Verify Your Email for BLOGGY',
                text: `Hello ${user.userHandle},\n\nPlease verify your account by clicking the link: \nhttp:\/\/${req.headers.host}\/verify\/${token}\n\nThis link will expire in one hour.\n`
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) {
                    console.log("Error sending verification email", error);
                    return res.render("signup", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'Could not send verification email. Please contact support.'}, user: req.user });
                }
                res.redirect("/pending-verification");
            });
        });
    });
});

//post SignIn
app.post('/signin', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) {
      return res.render("signin", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'Invalid email or password.'}, user: req.user });
    }
    if (!user.isVerified) {
      return res.render("signin", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'Your account is not verified. Please check your email.'}, user: req.user });
    }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect('/');
    });
  })(req, res, next);
});

//get verify email
app.get('/verify/:token', (req, res) => {
    User.findOne({
        verificationToken: req.params.token,
        verificationTokenExpires: { $gt: Date.now() }
    }, (err, user) => {
        if (err || !user) {
            return res.render("signin", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'Verification token is invalid or has expired.'}, user: req.user });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;

        user.save((err) => {
            if (err) {
                console.log(err);
                return res.render("signin", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'An error occurred during verification.'}, user: req.user });
            }
            req.logIn(user, (err) => {
                if(err) {
                    return res.render("signin", { authenticated: req.isAuthenticated(), message: {type: 'danger', text: 'An error occurred logging you in.'}, user: req.user });
                }
                res.redirect('/');
            });
        });
    });
});

app.get('/pending-verification', (req, res) => {
    res.render('pending-verification', { authenticated: req.isAuthenticated(), user: req.user });
});

//get LogOut
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

//get Compose
app.get("/compose", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("compose", { authenticated: req.isAuthenticated(), user: req.user });
  } else {
    res.redirect("/signin");
  }
});

//post Compose
app.post("/compose", (req, res) => {
  if(!req.isAuthenticated()){
    return res.redirect("/signin");
  }
  User.findById(req.user.id, (err, foundUser) => {
    if (err) {
      console.log(err);
      res.send("Please log in to post.");
    } else {
      const today = new Date();
      const dateTime =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        today.getDate() +
        " " +
        today.getHours() +
        ":" +
        today.getMinutes() +
        ":" +
        today.getSeconds();

      const post = new Post({
        title: req.body.postTitle,
        content: req.body.postBody,
        markdown: req.body.postMarkdown,
        account: foundUser.userHandle,
        email: foundUser.username,
        authorId: req.user.id,
        timestamp: dateTime,
        likes: 0,
      });

      post.save();

      foundUser.posts.push(post);

      foundUser.save(() => {
        res.redirect("/");
      });
    }
  });
});

//get Profile of own
app.get("/profile", (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, (err, foundUser) => {
      if (err) {
        console.log(err);
        res.send("Please log in to see your profile.");
      } else {
        if (foundUser) {
          let profile_name = foundUser.userHandle;
          profile_name.replace(/\s+/g, "");
          res.render("profile", {
            newPost: foundUser.posts,
            userName: profile_name,
            authenticated: req.isAuthenticated(),
            user: req.user,
            visitor: false,
          });
        } else {
          res.send("Please log in to see your profile.");
        }
      }
    });
  } else {
    res.redirect("/signin");
  }
});

//get profile of others
app.get("/profile/:profileId", (req, res) => {
  const profileId = req.params.profileId;
  User.findById(profileId, (err, foundUser) => {
    if (err || !foundUser) {
      console.log(err);
      res.send("User not found");
    } else {
      if (req.isAuthenticated()) {
        if (req.user.id === profileId) {
            return res.redirect("/profile");
        }
        res.render("profile", {
            newPost: foundUser.posts,
            userName: foundUser.userHandle,
            authenticated: req.isAuthenticated(),
            user: req.user,
            visitor: true,
        });
      } else {
        res.render("profile", {
          newPost: foundUser.posts,
          userName: foundUser.userHandle,
          authenticated: req.isAuthenticated(),
          user: null,
          visitor: true,
        });
      }
    }
  });
});

//get Particular Post
app.get("/posts/:postId", (req, res) => {
  const requestedPostId = req.params.postId;
  Post.findById(requestedPostId, (err, foundPost) => {
    if (err) {
      console.log(err);
      res.send("There was an error retrieving the post.");
    } else {
      if (foundPost) {
        let isAuthor = false;
        if(req.isAuthenticated() && req.user.id === foundPost.authorId.toString()){
            isAuthor = true;
        }

        res.render("post", {
            id: foundPost._id,
            authorId: foundPost.authorId,
            title: foundPost.title,
            author: foundPost.account,
            content: foundPost.content,
            markdown: foundPost.sanitizedHtml,
            visitor: !isAuthor,
            authenticated: req.isAuthenticated(),
            user: req.user
        });

      } else {
        res.send("Post not found");
      }
    }
  });
});

//post Like
app.post("/like", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/signin");
  }
  const liked = req.body.liked;
  const postId = req.body.postId;

  User.findById(req.user.id, (err, foundUser) => {
    if (err) {
      console.log(err);
      res.send("There was an error. Please try again.");
    } else {
      if (liked === "true") {
        foundUser.likedPosts.push(postId);
        foundUser.save();
        Post.findByIdAndUpdate(postId, { $inc: { likes: 1 } }, (err, foundPost) => {
          if (err) {
            console.log(err);
          }
          res.redirect("back");
        });
      } else {
        foundUser.likedPosts.pull(postId);
        foundUser.save();
        Post.findByIdAndUpdate(postId, { $inc: { likes: -1 } }, (err, foundPost) => {
          if (err) {
            console.log(err);
          }
          res.redirect("back");
        });
      }
    }
  });
});

//delete post
app.post("/delete", (req, res) => {
  if(!req.isAuthenticated()){
    return res.redirect("/signin");
  }
  const postId = req.body.postId;
  
  Post.findById(postId, (err, foundPost) => {
    if (err || !foundPost) {
      console.log(err);
      return res.send("Post not found.");
    } 

    // Allow deletion if user is the author OR user is an admin
    if(foundPost.authorId.toString() !== req.user.id.toString() && req.user.role !== 'admin'){
        return res.status(403).send("You are not authorized to delete this post.");
    }

    // This pulls the post from the user's post array
    User.updateOne({ _id: foundPost.authorId }, { $pull: { posts: { _id: postId } } }, (err, result) => {
        if(err) {
            console.log("Error removing post from user array", err);
        }
    });

    Post.findByIdAndDelete(postId, (err, deletedPost) => {
        if (err) {
        console.log(err);
        res.send("There was an error. Please try again.");
        } else {
        res.redirect("/profile");
        }
    });
  });
});

app.get("/contact", (req, res) => {
  res.render("contact", {
    authenticated: req.isAuthenticated(),
    user: req.user,
    message: null,
  });
});

app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email credentials not set in .env file.");
    return res.render("contact", {
      authenticated: req.isAuthenticated(),
      user: req.user,
      message: {
        type: "danger",
        text: "Server error: Email service not configured.",
      },
    });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailToAdminOptions = {
    from: `"${name}" <${email}>`,
    to: "rakshitbanal15@gmail.com",
    subject: `New Feedback from ${name} via BLOGGY`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
  };

  const mailToUserOptions = {
    from: `"BLOGGY" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "We have received your feedback!",
    text: `Hi ${name},\n\nThank you for contacting us. We have received your message and will get back to you shortly.\n\nBest Regards,\nThe BLOGGY Team`,
  };

  transporter.sendMail(mailToAdminOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.render("contact", {
        authenticated: req.isAuthenticated(),
        user: req.user,
        message: { type: "danger", text: "Something went wrong. Please try again." },
      });
    }
    console.log("Message sent to admin: %s", info.messageId);

    transporter.sendMail(mailToUserOptions, (error, info) => {
      if (error) {
        console.log("Failed to send acknowledgement email to user:", error);
      } else {
        console.log("Acknowledgement sent to user: %s", info.messageId);
      }
    });

    res.render("contact", {
      authenticated: req.isAuthenticated(),
      user: req.user,
      message: { type: "success", text: "Thank you! Your feedback has been sent." },
    });
  });
});

app.get("/about", (req, res) => {
  res.render("about", { authenticated: req.isAuthenticated(), user: req.user });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("Server has started successfully");
});