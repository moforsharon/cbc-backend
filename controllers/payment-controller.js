const config = require("config");
const { fetchData } = require("../libs/fetchData");
const jwt = require("jsonwebtoken");
const { getObjectId } = require("../libs/id");
const { response } = require("../response");
const Stripe = require("stripe");
const { newDate } = require("../libs/newDate");
const { timestamptoMySqlTime } = require("../libs/newDate");
const { RunQuery, RunTransactionQuery } = require("../services");
const {
  beginTransaction,
  rollbackTransaction,
  commitTransaction,
} = require("../connection");

console.log(
  "process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY",
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY
);
const stripe = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY);

async function getPricing(req, res) {
  try {
    console.log("getpricing start");
    let planQuery = `select * from plans pp where status = 1 order by 
        FIELD(pp.plan_name, 'free') DESC,
        FIELD(pp.plan_name, 'basicmonth') DESC,FIELD(pp.plan_name, 'basicyear') DESC,
        FIELD(pp.plan_name, 'plusmonth') DESC,FIELD(pp.plan_name, 'plusyear') DESC,
        FIELD(pp.plan_name, 'premiummonth') DESC,FIELD(pp.plan_name, 'premiumyear') DESC,
        FIELD(pp.plan_name, 'addmsg') DESC,FIELD(pp.plan_name, 'addbot') DESC,
        FIELD(pp.plan_name, 'removelogo') DESC;`;
    const planResult = await RunQuery(planQuery);

    let contentQuery = `SELECT * FROM chatwebby.plan_content where status = 1;`;
    const contentResult = await RunQuery(contentQuery);

    const plans = planResult?.success.map((planItem) => {
      const contentItems = contentResult?.success
        .filter(
          (contentItem) => contentItem.display_name === planItem.display_name
        )
        .map((contentItem) => contentItem.content); // Extracting only the 'content' values

      const lifetime = planResult?.success?.find(
        (contentItem) =>
          contentItem.display_name === planItem.display_name &&
          contentItem.duration === "one_time"
      );

      return { ...planItem, content: contentItems, lifetime };
    });

    // console.log({ plans });

    res.status(200).json(response(plans, null, ""));
  } catch (error) {
    res
      .status(500)
      .json(response(null, null, "UNABLE TO GET PAYMENT PLANS", error));
  }
}

async function paymentSuccess(req, res) {
  try {
    //console.log('session', req.body.session_id);

    console.log("req.body.session_id", req?.body?.session_id);
    const session = await stripe.checkout.sessions.retrieve(
      req?.body?.session_id,
      {
        expand: [
          "line_items.data.price.product",
          "subscription.default_payment_method",
          "subscription.plan.product",
        ],
      }
    );

    console.log("session", session);

    if (
      session &&
      session?.status != "complete" &&
      session?.payment_status != "paid"
    ) {
      return response
        .status(400)
        .json(response(null, null, "Payment is not paid."));
    }

    //console.log('1122', session);

    const item = session?.line_items?.data[0];
    const email = session?.customer_details?.email;

    // var getPlanQuery = `select * from plans pl where pl.plan_name=?`;

    // const planResult = await RunQuery(getPlanQuery, [getPlanName(item)]);

    // if (!planResult?.success) {
    //     return res
    //         .status(400)
    //         .json(response(null, null, "Can't find relevant plan"));
    // }

    var getPlanContentQuery = `select * from plan_content pc where pc.display_name=?;`;

    const planContentResult = await RunQuery(getPlanContentQuery, [
      getItemName(item),
    ]);

    if (!planContentResult?.success) {
      return res
        .status(400)
        .json(response(null, null, "Can't find relevant plan content"));
    }

    const object = {
      descriptionHeading: getDescriptionHeading(item),
      itemName: getItemName(item),
      qty: getQty(item),
      itemDurationDescription: getItemDurationDescription(item),
      amount: getAmount(session),
    };

    console.log("object", object);
    console.log(
      "planContentResult",
      planContentResult?.success,
      getItemName(item)
    );

    res.status(200).json(
      response(
        {
          object,
          planContentResult: planContentResult?.success,
        },
        null,
        ""
      )
    );
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

async function createCustomerPortalSession(req, res) {
  try {
    const email = req.headers["useremail"];
    console.log(email);

    let stripeCustomerId = "";
    // Check if customer exists
    const customerList = await stripe.customers.list({ email: email });

    if (customerList.data.length <= 0) {
      return res.status(404).json(response(null, null, "Customer not found!"));
    }

    stripeCustomerId = customerList.data[0].id;
    console.log("Customer exists:", stripeCustomerId);

    let data = {
      customer: stripeCustomerId,
      return_url: `${process.env.BASE_URL}account`,
    };
    // Authenticate your user.
    const session = await stripe.billingPortal.sessions.create(data);

    console.log("session", session);

    // Redirect the customer to the portal session
    res.status(200).json(response({ url: session.url }, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENT WRONG"));
  }
}

async function createCheckoutSession(req, res) {
  try {
    const price_id = req.body?.price_id;
    const payment_mode = req.body?.payment_mode;
    const qty = req.body?.qty;
    // const referralId = req.body?.referralId;
    const email = req.headers["useremail"];
    const user_id = req.headers["userid"];

    console.log("email ", email, price_id, payment_mode, qty);

    data = {
      // customer: 'cus_ON4JxUupUNjpy3',
      line_items: [
        {
          // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
          // price: data.price_id,
          price: price_id,
          quantity: qty,
        },
      ],
      mode: payment_mode,

      metadata: {
        user_id: user_id,
      },

      success_url: `${process.env.BASE_URL}payment-verified?session_id={CHECKOUT_SESSION_ID}`,
      // success_url: `${process.env.BASE_URL}pricing`,
      cancel_url: `${process.env.BASE_URL}pricing`,
      allow_promotion_codes: true,
    };

    // if (referralId) {
    //     data.client_reference_id = referralId;
    // }

    console.log("data ", data, email);

    //check if customer exist
    const customerList = await stripe.customers.list({ email: email });

    console.log("data123 ", customerList);

    if (customerList.data.length <= 0) {
      data.customer_email = email;
    } else {
      stripeCustomerId = customerList.data[0].id;
      console.log("Customer exists:", stripeCustomerId);

      data.customer = stripeCustomerId;
    }

    const session = await stripe.checkout.sessions.create(data);

    res.status(200).json(response({ url: session.url }, null, ""));
  } catch (error) {
    res.status(500).json(response(null, null, "SOMETHING WENTS WRONG"));
  }
}

const getInvoiceHeadingLine = (item) => {
  if (item?.price?.type === "recurring")
    return `Subscribe to ${item?.price?.product?.name}`;
  else return `Lifetime ${item?.price?.product?.name} Deal`;
};

const getAmount = (session) => {
  return session?.amount_total / 100;
};

const getQty = (item) => {
  return item?.quantity;
};

const getInvoiceDuration = (item) => {
  if (item?.price?.type === "recurring") return `Per month`;
  else return "Lifetime";
};

const getDescriptionHeading = (item) => {
  if (item?.price?.type === "recurring") return `Thanks for subscribing`;
  else return `Thanks for purchasing`;
};

const getproductMetadata = (item) => {
  return item?.price?.product?.metadata;
};

const getItemName = (item) => {
  return item?.price?.product?.name;
};

const getItemDurationDescription = (item) => {
  if (item?.price?.type === "recurring") return `Billed Monthly`;
  else return `Lifetime`;
};

//start by getting package attribute lines and show on front

const getSubscriptionType = (item) => {
  if (item?.price?.type === "recurring") {
    return item?.price?.recurring?.interval;
  } else if (item?.price?.type === "one_time") {
    return "life_time";
  } else {
    return null;
  }
};

const getSubscriptionId = (item, session) => {
  if (item?.price?.type === "recurring") {
    return session?.subscription?.id;
  } else return null;
};

const getPlanName = (item) => {
  return item?.price?.nickname;
};

const getduration = (item) => {
  if (item?.price?.type === "recurring") {
    if (item?.price?.recurring?.interval === "month") return "month";
    else return "year";
  } else return "month";
};

const getStripePriceId = (item) => {
  return item?.price?.id;
};

const getStripePriceNickname = (item) => {
  return item?.price?.nickname;
};

async function removePackageOpenInvoices(session) {
  if (session?.customer) {
    const openInvoices = await stripe.invoices.list({
      customer: session.customer,
      status: "open",
    });
    console.log("openinvoice", openInvoices.data[0]);

    // Loop through each open invoice and set it to "void"
    for (const invoice of openInvoices.data) {
      console.log("inoicevoidruns");
      await stripe.invoices.voidInvoice(invoice.id);
      console.log(
        `Invoice ${invoice.id} for Customer ${session.customer} set to "void"`
      );
    }
  }
}

function getQuantity(pQty, pValue) {
  let quantity = pQty ? pQty : 1;
  let value = pValue ? pValue : 1;

  return quantity * value;
}

// This is your Stripe CLI webhook secret for testing your endpoint locally.
// const endpointSecret = "whsec_mPQfU8nbKRoGyGjdH1rLM4LHgSgP5YY9";

async function webhook(req, res) {
  // transaction start
  let connection;
  try {
    console.log("webhook run");
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_END_POINT_SECRET
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log("event", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        {
          // const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
          //     expand: ['line_items.data.price.product', 'subscription.default_payment_method', 'subscription.plan.product']
          // });

          const session = await stripe.checkout.sessions.retrieve(
            event.data.object.id,
            {
              expand: [
                "line_items.data.price.product",
                "subscription.default_payment_method",
                "subscription.plan.product",
              ],
            }
          );

          const user_id = session.metadata.user_id;
          console.log("metadata.user_id", user_id);
          const item = session.line_items.data[0];
          const email = session.customer_details.email;

          if (
            session &&
            session?.status != "complete" &&
            session?.payment_status != "paid"
          ) {
            return res
              .status(400)
              .json(response(null, null, "Payment is not paid."));
          }

          console.log("userid@@@@@@ ", user_id);
          console.log("session@@@@@@ ", session);
          console.log("item@@@@@", item);

          var getPlanQuery = `SELECT * FROM plans WHERE plan_name = ?`;

          const planResult = await RunQuery(getPlanQuery, [
            getStripePriceNickname(item),
          ]);
          const plan = fetchData(planResult?.success);
          console.log("plan&&&&&&&&&&", plan?.category);

          if (!planResult?.success) {
            return res
              .status(400)
              .json(response(null, null, "Can't find relevant plan"));
          }

          if (plan?.category === "package" && plan?.duration === "one_time") {
            // lifetime case where user buys lifetime deal

            //first insert subscription
            var insertSubscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at,
                         status, bot_qty, msg_qty, plan_name, qty ) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

            const SubscriptionQueryValues = [
              getObjectId(),
              user_id,
              plan?.category,
              plan?.duration,
              newDate(),
              "active",
              getQuantity(item?.quantity, plan?.chatbots),
              getQuantity(item?.quantity, plan?.questions),
              plan?.plan_name,
              getQuantity(item?.quantity),
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for package"
                  )
                );
            }
          } else if (
            plan?.category === "package" &&
            (plan?.duration === "month" || plan?.duration === "year")
          ) {
            console.log(
              "plan?.category === package && (plan?.duration === month || plan?.duration === year"
            );

            //first insert subscription
            var insertSubscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at, current_period_start,
                        current_period_end, status, cancel_at, canceled_at, bot_qty, msg_qty, plan_name, qty ) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

            const SubscriptionQueryValues = [
              session?.subscription?.id,
              user_id,
              plan?.category,
              plan?.duration,
              session?.subscription?.start_date
                ? timestamptoMySqlTime(session?.subscription?.start_date)
                : null,
              session?.subscription?.current_period_start
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_start
                  )
                : null,
              session?.subscription?.current_period_end
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_end
                  )
                : null,
              session?.subscription?.status,
              session?.subscription?.cancel_at
                ? timestamptoMySqlTime(session?.subscription?.cancel_at)
                : null,
              session?.subscription?.canceled_at
                ? timestamptoMySqlTime(session?.subscription?.canceled_at)
                : null,
              getQuantity(item?.quantity, plan?.chatbots),
              getQuantity(item?.quantity, plan?.questions),
              plan?.plan_name,
              getQuantity(item?.quantity),
            ];

            console.log("SubscriptionQueryValues", SubscriptionQueryValues);

            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            console.log("resultSubscription", resultSubscription);
            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for package"
                  )
                );
            }
          } else if (plan?.category === "add_msg") {
            // insert new subscription in subscription table

            var insertSubscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at, current_period_start,
                                            current_period_end, status, cancel_at, canceled_at, msg_qty, plan_name, qty ) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

            const SubscriptionQueryValues = [
              session?.subscription?.id,
              user_id,
              plan?.category,
              plan?.duration,
              session?.subscription?.start_date
                ? timestamptoMySqlTime(session?.subscription?.start_date)
                : null,
              session?.subscription?.current_period_start
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_start
                  )
                : null,
              session?.subscription?.current_period_end
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_end
                  )
                : null,
              session?.subscription?.status,
              session?.subscription?.cancel_at
                ? timestamptoMySqlTime(session?.subscription?.cancel_at)
                : null,
              session?.subscription?.canceled_at
                ? timestamptoMySqlTime(session?.subscription?.canceled_at)
                : null,
              getQuantity(item?.quantity, 1000),
              plan?.plan_name,
              getQuantity(item?.quantity),
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for msg ad-on"
                  )
                );
            }
          } else if (plan?.category === "add_bot") {
            // insert new subscription in subscription table

            var insertSubscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at, current_period_start,
                                            current_period_end, status, cancel_at, canceled_at, bot_qty, plan_name, qty ) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

            const SubscriptionQueryValues = [
              session?.subscription?.id,
              user_id,
              plan?.category,
              plan?.duration,
              session?.subscription?.start_date
                ? timestamptoMySqlTime(session?.subscription?.start_date)
                : null,
              session?.subscription?.current_period_start
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_start
                  )
                : null,
              session?.subscription?.current_period_end
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_end
                  )
                : null,
              session?.subscription?.status,
              session?.subscription?.cancel_at
                ? timestamptoMySqlTime(session?.subscription?.cancel_at)
                : null,
              session?.subscription?.canceled_at
                ? timestamptoMySqlTime(session?.subscription?.canceled_at)
                : null,
              getQuantity(item?.quantity, 1),
              plan?.plan_name,
              getQuantity(item?.quantity),
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for bot ad-on"
                  )
                );
            }
          } else if (plan?.category === "remove_logo") {
            // insert new subscription in subscription table

            var insertSubscriptionQuery = `INSERT INTO subscriptions (subscription_id, user_id, subscription_type, duration, create_at, current_period_start,
                    current_period_end, status, cancel_at, canceled_at, plan_name, qty ) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

            const SubscriptionQueryValues = [
              session?.subscription?.id,
              user_id,
              plan?.category,
              plan?.duration,
              session?.subscription?.start_date
                ? timestamptoMySqlTime(session?.subscription?.start_date)
                : null,
              session?.subscription?.current_period_start
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_start
                  )
                : null,
              session?.subscription?.current_period_end
                ? timestamptoMySqlTime(
                    session?.subscription?.current_period_end
                  )
                : null,
              session?.subscription?.status,
              session?.subscription?.cancel_at
                ? timestamptoMySqlTime(session?.subscription?.cancel_at)
                : null,
              session?.subscription?.canceled_at
                ? timestamptoMySqlTime(session?.subscription?.canceled_at)
                : null,
              plan?.plan_name,
              getQuantity(item?.quantity),
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for remove logo ad-on"
                  )
                );
            }
          }
        }
        break;
      case "customer.created":
        {
          const customerCreated = event.data.object;

          console.log("customerCreated", customerCreated);
          var query = `
                  Update users set stripe_cus_id=?, stripe_cus_created=? where email=?`;

          console.log("array", [
            customerCreated?.id,
            customerCreated?.created
              ? timestamptoMySqlTime(customerCreated?.created)
              : null,
            customerCreated?.email,
          ]);
          const updateUserquery = await RunQuery(query, [
            customerCreated?.id,
            customerCreated?.created
              ? timestamptoMySqlTime(customerCreated?.created)
              : null,
            customerCreated?.email,
          ]);
        }
        // Then define and call a function to handle the event customer.created
        break;
      case "customer.subscription.deleted":
        {
          console.log("subscriptionupdateruns");
          let customerSubscriptionUpdated = event.data.object;
          const customerId = customerSubscriptionUpdated?.customer;
          const customer = await stripe.customers.retrieve(customerId);

          const PriceObject = await stripe.prices.retrieve(
            customerSubscriptionUpdated?.plan?.id
          );

          const customerEmail = customer.email;
          const planName = PriceObject?.nickname;

          var getPlanQuery = `SELECT * FROM plans WHERE plan_name = ?`;

          const planResult = await RunQuery(getPlanQuery, [planName]);
          const plan = fetchData(planResult?.success);
          console.log("plan&&&&&&&&&&", plan);

          if (!planResult?.success) {
            return res
              .status(400)
              .json(response(null, null, "Can't find relevant plan"));
          }

          var getUserQuery = `SELECT * FROM users WHERE email = ?`;

          userResult = await RunQuery(getUserQuery, [customerEmail]);
          const user = fetchData(userResult?.success);
          console.log("plan&&&&&&&&&&", user);

          if (!userResult?.success) {
            return res
              .status(400)
              .json(response(null, null, "Can't find relevant user"));
          }

          const user_id = user?.user_id;

          if (
            plan?.category === "package" &&
            (plan?.duration === "month" || plan?.duration === "year")
          ) {
            var updateSubscriptionQuery = `UPDATE subscriptions set user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, comment=?, feedback=?, reason=?, bot_qty=?, msg_qty=?, plan_name=?, qty=?  where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              getQuantity(
                customerSubscriptionUpdated?.quantity,
                plan?.chatbots
              ),
              getQuantity(
                customerSubscriptionUpdated?.quantity,
                plan?.questions
              ),
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];

            const resultSubscription = await RunQuery(
              updateSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for package"
                  )
                );
            }
          } else if (plan?.category === "add_msg") {
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              0,
              getQuantity(customerSubscriptionUpdated?.quantity, 1000),

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for msg ad-on"
                  )
                );
            }
          } else if (plan?.category === "add_bot") {
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              getQuantity(customerSubscriptionUpdated?.quantity, 1),
              0,

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for bot ad-on"
                  )
                );
            }
          } else if (plan?.category === "remove_logo") {
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                        current_period_end=?, status=?, cancel_at=?, canceled_at=?,bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=? `;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              0,
              0,

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for remove logo ad-on"
                  )
                );
            }
          }
        }

        break;

      case "customer.subscription.updated":
        {
          console.log("subscriptionupdateruns");
          const customerSubscriptionUpdated = event.data.object;
          const customerId = customerSubscriptionUpdated?.customer;
          const customer = await stripe.customers.retrieve(customerId);

          const PriceObject = await stripe.prices.retrieve(
            customerSubscriptionUpdated?.plan?.id
          );

          const customerEmail = customer.email;
          const planName = PriceObject?.nickname;

          var getPlanQuery = `SELECT * FROM plans WHERE plan_name = ?`;

          const planResult = await RunQuery(getPlanQuery, [planName]);
          const plan = fetchData(planResult?.success);
          console.log("plan&&&&&&&&&&", plan);

          if (!planResult?.success) {
            return res
              .status(400)
              .json(response(null, null, "Can't find relevant plan"));
          }

          var getUserQuery = `SELECT * FROM users WHERE email = ?`;

          userResult = await RunQuery(getUserQuery, [customerEmail]);
          const user = fetchData(userResult?.success);
          console.log("plan&&&&&&&&&&", user);

          if (!userResult?.success) {
            return res
              .status(400)
              .json(response(null, null, "Can't find relevant user"));
          }

          const user_id = user?.user_id;

          if (
            plan?.category === "package" &&
            (plan?.duration === "month" || plan?.duration === "year")
          ) {
            var updateSubscriptionQuery = `UPDATE subscriptions set user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, comment=?, feedback=?, reason=?, bot_qty=?, msg_qty=?, plan_name=?, qty=?  where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              getQuantity(
                customerSubscriptionUpdated?.quantity,
                plan?.chatbots
              ),
              getQuantity(
                customerSubscriptionUpdated?.quantity,
                plan?.questions
              ),
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];

            const resultSubscription = await RunQuery(
              updateSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for package"
                  )
                );
            }
          } else if (plan?.category === "add_msg") {
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              0,
              getQuantity(customerSubscriptionUpdated?.quantity, 1000),

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for msg ad-on"
                  )
                );
            }
          } else if (plan?.category === "add_bot") {
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=?`;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              getQuantity(customerSubscriptionUpdated?.quantity, 1),
              0,

              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,
              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for bot ad-on"
                  )
                );
            }
          } else if (plan?.category === "remove_logo") {
            console.log("removelogoruns");
            // update subscription in subscription table

            var insertSubscriptionQuery = `UPDATE subscriptions SET user_id=?, subscription_type=?, duration=?, create_at=?, current_period_start=?,
                        current_period_end=?, status=?, cancel_at=?, canceled_at=?, bot_qty=?, msg_qty=?, comment=?, feedback=?, reason=?, plan_name=?, qty=? where subscription_id=? `;

            const SubscriptionQueryValues = [
              user_id,
              plan?.category,
              plan?.duration,
              customerSubscriptionUpdated?.start_date
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.start_date)
                : null,
              customerSubscriptionUpdated?.current_period_start
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_start
                  )
                : null,
              customerSubscriptionUpdated?.current_period_end
                ? timestamptoMySqlTime(
                    customerSubscriptionUpdated?.current_period_end
                  )
                : null,
              customerSubscriptionUpdated?.status,
              customerSubscriptionUpdated?.cancel_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.cancel_at)
                : null,
              customerSubscriptionUpdated?.canceled_at
                ? timestamptoMySqlTime(customerSubscriptionUpdated?.canceled_at)
                : null,
              0,
              0,
              customerSubscriptionUpdated?.cancellation_details?.comment
                ? customerSubscriptionUpdated?.cancellation_details?.comment
                : null,
              customerSubscriptionUpdated?.cancellation_details?.feedback
                ? customerSubscriptionUpdated?.cancellation_details?.feedback
                : null,
              customerSubscriptionUpdated?.cancellation_details?.reason
                ? customerSubscriptionUpdated?.cancellation_details?.reason
                : null,

              plan?.plan_name,
              getQuantity(customerSubscriptionUpdated?.quantity),

              customerSubscriptionUpdated?.id,
            ];

            console.log("insertSubscriptionQuery", insertSubscriptionQuery);
            console.log("SubscriptionQueryValues", SubscriptionQueryValues);
            const resultSubscription = await RunQuery(
              insertSubscriptionQuery,
              SubscriptionQueryValues
            );

            if (!resultSubscription?.success) {
              return res
                .status(500)
                .json(
                  response(
                    null,
                    null,
                    "Failed to insert subscription data for remove logo ad-on"
                  )
                );
            }
          }
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // res.status(200).json(response(null, null, ""));
    // Return a 200 response to acknowledge receipt of the event
    res.send();
  } catch (err) {
    if (connection) await rollbackTransaction(connection);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
}

module.exports = {
  getPricing,
  paymentSuccess,
  webhook,
  createCustomerPortalSession,
  createCheckoutSession,
};
