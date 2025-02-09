var nodemailer = require("nodemailer");

async function sendMail(toEmail) {
  try {
    console.log(toEmail, "hwekki");

    //   var transporter = nodemailer.createTransport({
    //   port: 465,
    //   host: "smtp.gmail.com",
    //   secure: true,
    //   auth: {
    //     user: 'chatwebbyai@gmail.com',
    //     pass: 'shsokuslkpqsobnt'
    //   },
    // });
    var transporter = nodemailer.createTransport({
      port: 465,
      host: "smtp.mail.us-east-1.awsapps.com",
      secure: true,
      auth: {
        user: "zain@chatdox.com",
        pass: "5121472Masumeen!!",
      },
    });
    //   readHTMLFile(__dirname + '/pages/views/index.html', function(err, html) {
    //     if (err) {
    //        console.log('error reading file', err);
    //        return;
    //     }
    //   });
    //   const path = require('path');
    //   const templatePath = path.join(process.cwd(), 'public/emails/template.html');
    //   console.log('process.env',process.cwd());
    // const templateContent = fs.readFileSync(templatePath, 'utf8');

    // var template = handlebars.compile(html);
    // var replacements = {
    //      username: "John Doe"S
    // };
    // var htmlToSend = template(replacements);
    var mailOptions = {
      from: "zain@chatdox.com",
      to: toEmail,
      subject: `You have received a new lead from ${toEmail} - Keep the conversation going.`,
      html: `
      <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome To Ola Books</title>
    </head>
    <body
      style="
        font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial,
          sans-serif;
        margin: 0;
        font-weight: 400;
      "
    >
      <div class="row" style="background-color: white">
        <div
          class="column"
          style="width: 100%; margin-bottom: 16px; padding: 0 50px"
        >
          <div
            class="card"
            style="
              margin: 8px;
              padding: 5% 10%;
              background: linear-gradient(0deg, #EAECEB 100%);
              display: flex;
              justify-content: center;
              align-items: center;
            "
          >
            <div
              class="container-email"
              style="
                text-align: center;
                box-shadow: rgba(157, 157, 167, 0.2) 0px 7px 29px 0px;
                border: 1px solid rgba(180, 180, 180, 0.344);
                width: 600px;
                border-radius: 5px;
                background-color: white;
                padding: 20px 50px;
              "
            >
              <img src="https://base.cx/img/favicon.png" alt="aiIcon" style="background-color:white; width:80px"/>
              <h2 style="text-align: center">WELCOME TO ChatWebby AI</h2>
              <br />
              <p>
                You (${toEmail}) signed up for early access of base.cx We will send you the details with lots of gifts and offers shortly. :)
              </p>
              <p></p>
              <br />
              <p>Cheers,</p>
              <p>Team Chat Webby AI</p>
            </div>
          </div>
        </div>
      </div>
    </body>`,
    };

    console.log("Sending Email");
    transporter.sendMail(mailOptions);
    console.log("Email Sent");
    return true;
  } catch (error) {
    console.log(error, "reereeeeeeeeeeeeeeeeeeeeeee");
  }
}

module.exports = { sendMail };
