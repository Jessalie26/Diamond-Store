export default async function handler(req, res) {

  const APPSCRIPT_URL =
    process.env.APPSCRIPT_URL;

  if (!APPSCRIPT_URL) {

    return res.status(500).json({
      success: false,
      message: "APPSCRIPT_URL environment variable is missing."
    });
  }


  try {

    let response;


    if (req.method === "GET") {

      const params =
        new URLSearchParams(req.query);

      response =
        await fetch(
          APPSCRIPT_URL +
          "?" +
          params.toString()
        );

    } else if (req.method === "POST") {

      response =
        await fetch(
          APPSCRIPT_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify(req.body)
          }
        );

    } else {

      return res.status(405).json({
        success: false,
        message: "Method not allowed."
      });
    }


    const text =
      await response.text();


    let data;

    try {

      data = JSON.parse(text);

    } catch {

      data = {
        success: false,
        message: text
      };
    }


    return res
      .status(200)
      .json(data);


  } catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Backend connection error: " +
        error.message

    });
  }
}
