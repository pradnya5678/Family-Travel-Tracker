import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "World",
  password: "12345678",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 3;
async function getCurrentUser() {
  // Assuming your users array is already populated or fetched from the database
  // Find the user with matching id
  let users=await db.query("SELECT * FROM users");
  users=users.rows;
  console.log(users);
  const currentUser = users.find(user => user.id === currentUserId);
  //console.log(currentUser);
  return currentUser;
}



async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id=$1",[currentUserId]);
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}
app.get("/", async (req, res) => {
  let users=await db.query("SELECT * FROM users");
  users=users.rows;
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  console.log(currentUserId);
  console.log(currentUser);
  const userColorQueryResult = await db.query("SELECT color FROM users WHERE id = $1", [currentUserId]);
  const userColor = userColorQueryResult.rows[0].color;
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: userColor,
    currentUser: currentUser 
  });
});
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  
  try {
      // Retrieve the country code from the database based on the input country name
      const result = await db.query(
          "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
          [input.toLowerCase()]
      );
      const data = result.rows[0];
      const countryCode = data.country_code;
      try {
          // Insert the country_code and user_id into the visited_countries table
          await db.query("INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",[countryCode, currentUserId]);
          res.redirect("/");
      } catch (err) {
          // Handle insertion error
          let users=await db.query("SELECT * FROM users");
          users=users.rows;
          const countries = await checkVisisted();
          const userColorQueryResult = await db.query("SELECT color FROM users WHERE id = $1", [currentUserId]);
          const userColor = userColorQueryResult.rows[0].color;
          const currentUser = await getCurrentUser();
          
          res.render("index.ejs", { 
              countries: countries,
              total: countries.length,
              users: users,
              color: userColor,
              currentUser: currentUser,
              error: "Country has already been added, try again"
          });
      }
  } catch (err) {
      // Handle error when country does not exist
      let users=await db.query("SELECT * FROM users");
      users=users.rows;
      const countries = await checkVisisted();
      const userColorQueryResult = await db.query("SELECT color FROM users WHERE id = $1", [currentUserId]);
      const userColor = userColorQueryResult.rows[0].color;
      const currentUser = await getCurrentUser();
      
      res.render("index.ejs", { 
          countries: countries,
          total: countries.length,
          users: users,
          color: userColor,
          currentUser: currentUser,
          error: "Country does not exist, try again"
      });
  }
});

  app.post("/user", async (req, res) => {
  if(req.body.add){
    res.render("new.ejs",{ error: null });
  }
  else{
    let users=await db.query("SELECT * FROM users");
    users=users.rows;
    try {
      // Update the currentUserId
      currentUserId = parseInt(req.body.user);

      // Fetch the data related to the new current user
      const currentUser = await getCurrentUser();
      const countries = await checkVisisted();
      const userColorQueryResult = await db.query("SELECT color FROM users WHERE id = $1", [currentUserId]);
      const userColor = userColorQueryResult.rows[0].color;
      // Render the index.ejs template with the updated data
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: userColor,
        currentUser: currentUser,
      });
    } catch (err) {
      console.error("Error handling /user route:", err);
      res.status(500).send("Internal Server Error");
    }
  }
  });
  

  app.post("/new", async (req, res) => {
    const name = req.body.name;
    const color = req.body.color;
    
    try {
      // Check if the name already exists in the database
      const existingUser = await db.query("SELECT * FROM users WHERE name = $1", [name]);
      if (existingUser.rows.length > 0) {
        // If the name already exists, render the same page with an error message
        res.render("new.ejs", { error: "Name already exists, please choose another one" });
        return; // Exit the function early
      }
  
      // If the name doesn't exist, proceed with inserting the new user
      const result = await db.query("INSERT INTO users(name, color) VALUES ($1, $2) RETURNING id", [name, color]);
      const userId = result.rows[0].id;
      currentUserId = parseInt(userId);
      res.redirect("/");
  
    } catch (error) {
      console.error("Error adding new user:", error);
      res.status(500).send("Error adding new user");
    }
  });
  
app.post("/delete",async(req,res)=>{
  const id=parseInt(req.body.user_id);
  await db.query("DELETE FROM visited_countries WHERE user_id = $1", [id]);
  await db.query("DELETE FROM users WHERE id = $1", [id]);
  currentUserId=3;
  res.redirect("/");
})
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
