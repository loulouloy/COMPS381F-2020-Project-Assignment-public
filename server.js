//const domainName = 'localhost';
const domainName = ''; //for cloud
const portNumber = 8099; //port number
const link = domainName + ':' + portNumber;
const bodyParser = require('body-parser');
const express = require('express');
const session = require('cookie-session');
const fs = require('fs');
const fetch = require('node-fetch');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const http = require('http');
const url = require('url');
const formidable = require('formidable');
const dbName = 'COMPS381F_2020_Project_Assignment';
const mongourl = '';//mongodb+srv
const KEY = 'I like COMPS381F very much';
const users = [
    {name: 'demo', password: ''},
    {name: 'student', password: ''},
    {name: 'testac', password: 'test1234'}
];


app.set('view engine', 'ejs');
app.use(express.static('views'));
app.use(session({
    name: 'loginSession',
    keys: [KEY],
    maxAge: 30 * 60 * 1000 //30 min
}));

// support parsing of application/json type post data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//Create restaurant
const insertDocument = (db, doc, callback) => {
    db.collection('restaurants').insertOne(doc, (err, results) => {
        assert.equal(err, null);
        console.log('insert was successful');
        callback(results);
    });
}

//Update restaurant
const updateDocument = (db, id, doc, callback) => {
    db.collection('restaurants').updateOne(id, {$set: doc}, (err, results) => {
        assert.equal(err, null);
        console.log("update was successful");
        callback(results);
    });
}

//Get all restaurant
const findAllDocument = (db, callback) => {
    let cursor = db.collection('restaurants').find();
    cursor.toArray((err, docs) => {
        assert.equal(err, null);
        callback(docs);
    })
}

//Find restaurant
const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('restaurants').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err, docs) => {
        assert.equal(err, null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

//delete restaurant
const deleteDocument = (db, criteria, callback) => {
    db.collection('restaurants').deleteOne(criteria, (err, results) => {
        assert.equal(err, null);
        console.log('delete was successful');
        callback(results);
    })
}

const handle_insert = (req, res) => {
    // console.log(doc.name);
    const form = formidable({multiples: true});
    form.parse(req, (err, fields, files) => {
            if (err) {
                next(err);
            } else if (!fields.name) {
                res.status(500).render('error', {mesg: "No restaurant name!!!"});
            } else {
                fs.readFile(files.image.path, (err, data) => {
                    if (files.image.size > 2097152) {
                        res.status(500).render('error', {mesg: "The photo size should not be larger than 2MB"});
                        return;
                    }
                    let img = new Buffer.from(data).toString('base64');
                    let doc = {
                        "name": fields.name,
                        "borough": fields.borough,
                        "cuisine": fields.cuisine,
                        "photo": img,
                        "photo_minetype": files.image.type,
                        "address": {
                            "street": fields.street,
                            "building": fields.building,
                            "zipcode": fields.zipcode,
                            "coord": [fields.gps_lat, fields.gps_lon],
                        },
                        "grades": [],
                        "owner": req.session.username,
                        "restaurant_id": null
                    };
                    const client = new MongoClient(mongourl);
                    client.connect((err) => {
                        assert.equal(null, err);
                        console.log("Connected successfully to server");
                        const db = client.db(dbName);
                        insertDocument(db, doc, (results) => {
                            console.log(`Inserted document(s): ${results.insertedCount}`);
                            client.close();
                            console.log("Closed DB connection");
                            res.redirect('/display?_id=' + doc._id);
                        });
                    });
                });
            }
        }
    );
}

const handle_edit = (req, res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        let DOCID = {};
        try {
            DOCID['_id'] = ObjectID(req.query._id)
            findDocument(db, DOCID, (docs) => {
                client.close();
                console.log("Closed DB connection");
                if (docs[0] === undefined) {
                    res.status(500).render('error', {mesg: 'Id not found!!!'});
                } else if (docs[0].owner !== req.session.username) {
                    res.status(500).render('error', {mesg: "You are not authorized to edit!!!"});
                } else {
                    res.status(200).render('edit_form', {docs: docs[0]});
                }
            });
        } catch (error) {
            res.status(500).render('error', {mesg: "Incorrect id!!!"});
        }
    });
}

const handle_update = (req, res) => {
    const form = formidable({multiples: true});
    form.parse(req, (err, fields, files) => {
        if (err) {
            next(err);
        } else if (!fields.name) {
            res.status(500).render('error', {mesg: "No restaurant name!!!"});
        } else {
            try {
                fs.readFile(files.image.path, (err, data) => {
                    if (files.image.size > 2097152) {
                        res.status(500).render('error', {mesg: "The photo size should not be larger than 2MB"});
                        return;
                    }
                    let img
                    let type
                    if (files.image.size > 0) {
                        img = new Buffer.from(data).toString('base64');
                        type = files.image.type;
                    } else {
                        img = fields.photo;
                        type = fields.photo_minetype;
                    }
                    let doc = {
                        "name": fields.name,
                        "borough": fields.borough,
                        "cuisine": fields.cuisine,
                        "photo": img,
                        "photo_minetype": type,
                        "address": {
                            "street": fields.street,
                            "building": fields.building,
                            "zipcode": fields.zipcode,
                            "coord": [fields.gps_lat, fields.gps_lon],
                        },
                    };
                    const client = new MongoClient(mongourl);
                    client.connect((err) => {
                        assert.equal(null, err);
                        console.log("Connected successfully to server");
                        const db = client.db(dbName);
                        let DOCID = {};
                        DOCID['_id'] = ObjectID(fields._id);
                        findDocument(db, DOCID, (docs) => {
                            if (docs[0].owner === req.session.username) {
                                updateDocument(db, DOCID, doc, (results) => {
                                    console.log(`Updated document(s): ${results.modifiedCount}`);
                                    client.close();
                                    console.log("Closed DB connection");
                                    res.redirect('/display?_id=' + fields._id);
                                });
                            } else {
                                client.close();
                                console.log("Closed DB connection");
                                res.status(500).render('error', {mesg: "You are not authorized to edit!!!"});
                            }
                        });
                    });
                });
            } catch (error) {
                res.status(500).render('error', {mesg: "Some error occur"});
            }
        }
    });
}

const handle_display_all = (req, res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        findAllDocument(db, (docs) => {
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('index', {name: req.session.username, docs: docs});
        });
    });
}

const handle_restaurant_info = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        let DOCID = {};
        try {
            DOCID['_id'] = ObjectID(criteria._id)
            findDocument(db, DOCID, (docs) => {
                client.close();
                console.log("Closed DB connection");
                if (docs[0] === undefined) {
                    res.status(500).render('error', {mesg: "Id not found!!!"});
                } else {
                    res.status(200).render('info', {docs: docs[0]});
                }
            });
        } catch (error) {
            res.status(500).render('error', {mesg: "Incorrect id!!!"});
        }
    });
}

const handle_rate = (req, res) => {
    const client = new MongoClient(mongourl);
    let rated = false;
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        let DOCID = {};
        try {
            DOCID['_id'] = ObjectID(req.body._id);
            findDocument(db, DOCID, (docs) => {
                if (docs[0].grades.length > 0) {
                    docs[0].grades.forEach(function (doc) {
                        if (doc.user === req.session.username) {
                            rated = true;
                        }
                    });
                }
                if (rated === true) {
                    res.status(500).render('error', {mesg: "You have rated this restaurant!!!"});
                    client.close();
                    console.log("Closed DB connection");
                } else {
                    db.collection('restaurants').updateOne({_id: DOCID['_id']},
                        {
                            $push: {
                                grades:
                                    {
                                        user: req.session.username,
                                        score: req.body.score
                                    }
                            }
                        }
                        , (err, results) => {
                            assert.equal(err, null);
                            console.log(`Updated document(s): ${results.result.nModified}`)
                        });
                    client.close();
                    console.log("Closed DB connection");
                    res.redirect('/display?_id=' + DOCID['_id']);
                }
            });
        } catch (error) {
            res.status(500).render('error', {mesg: "Some error occur"});
        }
    });
}

const handle_delete = (req, res, criteria) => {
    const client = new MongoClient(mongourl);
    let DOCID = {};
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        try {
            DOCID['_id'] = ObjectID(criteria._id);
            findDocument(db, DOCID, (docs) => {
                if (docs.length < 1) {
                    res.status(500).render('error', {mesg: "Sorry,this record has been deleted"});
                } else {
                    if (docs[0].owner === req.session.username) {
                        deleteDocument(db, DOCID, (results) => {
                            client.close();
                            console.log("Closed DB connection");
                            console.log(`Deleted document(s): ${results.deletedCount}`);
                            res.status(200).render('message', {mesg: "Record has been deleted"});
                        });
                    } else {
                        client.close();
                        console.log("Closed DB connection");
                        res.status(500).render('error', {mesg: "Sorry, only owner can do this action"});
                    }
                }
            });
        } catch (error) {
            res.status(500).render('error', {mesg: "Some error occur"});
        }
    });
}

const handle_search = (req, res) => {
    console.log(`check`, req.body.search, req.body.key);
    console.log(link + '/api/restaurant/' + req.body.search + '/' + req.body.key);
    http.get('http:' + link + '/api/restaurant/' + req.body.search + '/' + req.body.key, (httpRes) => {
        let body = "";
        httpRes.on("data", (chunk) => {
            body += chunk;
        });
        httpRes.on("end", () => {
            try {
                let json = JSON.parse(body);
                // if (json.length < 1) {
                //     res.status(500).render('error', {mesg: "No record has been found"});
                // } else {
                res.status(200).render('SearchResult', {
                    name: req.session.username,
                    docs: json,
                    search: req.body.search,
                    key: req.body.key
                });
                // }
            } catch (error) {
                console.error(error.message);
            }
            ;
        });

    }).on("error", (error) => {
        console.error(error.message);
    });
}

//Get and Post

app.get('/', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        res.redirect('/read');
    }
});

app.get('/read', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        handle_display_all(req, res);
    }
});

app.get('/display', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else if (!req.query._id) {
        res.status(500).render('error', {mesg: "Missing restaurant id!!!"});
    } else {
        handle_restaurant_info(res, req.query);
    }
});

app.get('/create', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        res.status(200).render('create_form', {});
    }
});

app.post('/create', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        handle_insert(req, res);
    }
});

app.get('/edit', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else if (!req.query._id) {
        res.status(500).render('error', {mesg: "Missing restaurant id!!!"});
    } else {
        handle_edit(req, res);
    }
});

app.post('/edit', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        handle_update(req, res);
    }
});

app.get('/rate', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        res.status(200).render('rate', {query: req.query._id});
    }
});

app.post('/rate', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        if (req.body.score <= 0 || req.body.score > 10) {
            res.status(500).render('error', {mesg: "Score must be 1 to 10!!!"});
        } else {
            handle_rate(req, res);
        }
    }
});

app.get('/delete', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        handle_delete(req, res, req.query);
    }
})

app.post('/search', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else {
        console.log(`check`, req.body.search, req.body.key);
        if (req.body.key && req.body.key != null) {
            handle_search(req, res);
        }
    }
})

app.get('/map', (req, res) => {
    if (!req.session.authenticated) {    // user not logged in!
        res.redirect('/login');
    } else if (!req.query.lat || !req.query.lon || !req.query.title || !req.query.id) {
        res.status(500).render('error', {mesg: "Missing some information!!!"});
    } else {
        res.status(200).render('map', {
            lat: req.query.lat,
            lon: req.query.lon,
            title: req.query.title,
            id: req.query.id
        });
    }
})

app.get('/login', (req, res) => {
    res.status(200).render('login', {});
});

app.post('/login', (req, res) => {
    users.forEach((user) => {
        if (user.name === req.body.name && user.password === req.body.password) {
            // correct user name + password
            // store the following name/value pairs in cookie session
            req.session.authenticated = true;        // 'authenticated': true
            req.session.username = req.body.name;	 // 'username': req.body.name
        }
    });
    res.redirect('/read');
});

app.get('/logout', (req, res) => {
    req.session = null;   // clear cookie-session
    res.redirect('/');
});

//RESTful API

app.get('/api/restaurant/name/:name', (req, res) => {
    if (req.params.name) {
        let criteria = {};
        criteria['name'] = req.params.name;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing restaurant name"});
    }
})

app.get('/api/restaurant/borough/:borough', (req, res) => {
    if (req.params.borough) {
        let criteria = {};
        criteria['borough'] = req.params.borough;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing restaurant borough"});
    }
})

app.get('/api/restaurant/cuisine/:cuisine', (req, res) => {
    if (req.params.cuisine) {
        let criteria = {};
        criteria['cuisine'] = req.params.cuisine;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing restaurant cuisine"});
    }
})

//404 page
app.get(/.*/, (req, res) => {
    res.status(404).send(req.url + ': Not Supported!');
});

app.listen(process.env.PORT || portNumber);