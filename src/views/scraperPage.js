import React, { useEffect, useState } from 'react';
import csvtojson from 'csvtojson';
import '../assets/styles/scraper.css';
import {FormControl, Select, MenuItem, InputLabel, Checkbox, FormControlLabel} from '@mui/material';
// import { withStyles } from '@mui/material/styles';
import infoLogo from '../assets/images/Icon - Janium Green.png';
import Papa from 'papaparse';

export default function Scraper() {
  const [scraperType, setScraperType] = useState('');
  const [fileErr, setFileErr] = useState(null);
  const [costErr, setCostErr] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [filename, setFilename] = useState('');
  const [column_names, setColumns] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [csvSource, setCsvSource] = useState('');
  const [emailThreshold, setEmailThreshold] = useState(80);
  const [cleanCsv, setCleanCsv] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [bottomInfo, setBottomInfo] = useState(false);
  const [completePercentage, setCompletePercentage] = useState(0);
  const [completeStatus, setCompleteStatus] = useState(false);
  const [emailOption, setEmailOption] = useState(false);
  const [phoneOption, setPhoneOption] = useState(false);
  const [emailColumn, setEmailColumn] = useState('');
  const [phoneColumn, setPhoneColumn] = useState('');
  const [resultData, setResultData] = useState([]);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [currentCredits, setCurrentCredits] = useState(null);

  // =================================================================================
  // Functions
  // =================================================================================

  useEffect(() => {
    async function getCredits() {
      // Gets the remaining credits left
      if (scraperType === 'profile-company' || scraperType === 'profile' || scraperType === 'company') {

        const response = await fetch('https://us-west3-foundation-production.cloudfunctions.net/enrich-csv-task-handler?scraperType=company-profile&selectedColumn=null&seamless=null&getCredits=true');
        const data = await response.json();

        const credits = data['credits'];
  
        setCurrentCredits(credits);

      } else if (scraperType === 'email-phone') {

        const response = await fetch('https://us-west3-foundation-production.cloudfunctions.net/enrich-csv-task-handler?scraperType=email-phone&selectedColumn=null&seamless=null&getCredits=true')
        const data = await response.json();

        const credits = data['credits'];

        setCurrentCredits(credits);
      }

      if (estimatedCost > currentCredits && currentCredits) {
        setCostErr("Projected credits exceed available credits: data can't be processed.");
      } else {
        setCostErr(null);
      }
    }

    function calculateEstimatedCredits() {
      let costPerCall = 0;

      if (csvData && scraperType !== '') {
        getCredits();

        if (scraperType === 'email-phone') {
          if (emailOption === true && phoneOption === true) {
            costPerCall = 2;
          } else {
            costPerCall = 1;
          }
        } else if (scraperType === 'profile-company') {
          costPerCall = 3;
        } else if (scraperType === 'profile' || scraperType === 'company') {
          costPerCall = 2;
        }

        const totalEntries = csvData.length;
        const totalCost = costPerCall * totalEntries;

        setEstimatedCost(totalCost);
      }
    } 

    calculateEstimatedCredits();
  }, [scraperType, csvData, emailOption, phoneOption, estimatedCost, currentCredits]);

  // Loops through csv data and sends it to API
  async function processData() {
    const totalEntries = csvData.length;
    let percent = 0;

    // Stores scraperType in new variable so it can be changed if needed
    let type = scraperType;

      if (type === 'email-phone') {
        if (emailOption === true && phoneOption === true) {
          type = 'email-phone';
        } else if (emailOption === true) {
          type = 'email';
        } else if (phoneOption === true) {
          type = 'phone';
        }
      }
  
    // Hold all the results after processing
    let result_list = [];
    // Hold the necessary data to be sent off to the API
    let queue = [];
    // Captures the data that will be sent to result_list
    let resultStaging = {};
    for (let i = 0; i < totalEntries; i++) {
      // calculates the percent. Doesn't get displayed till the end.
      percent = Math.round(((i+1)/totalEntries) * 100);

      // initializes json to hold a entry from csv
      let sem = false;
      if (csvSource === 'seamless') {
        sem = true;
      }

      let apiData = {
        scraperType: type,
        seamless: sem,
        extraColumns: {},
        emailColumn: null,
        phoneColumn: null
      }

      // For loop assigns values to both queue and resultStaging
      let csvResults = {};
      for (const [key, value] of Object.entries(csvData[i])) {
        csvResults[key] = value;
        if (key === selectedColumn) {
          apiData.selectedColumn = value;
        } else if (emailOption && key === emailColumn) {
          apiData.emailColumn = value;
        } else if (phoneOption && key === phoneColumn) {
          apiData.phoneColumn = value;
        } else {
          // apiData.extraColumns.push({[key]: value});
          apiData.extraColumns[`${key}`] = value;
        }
      }

      try {
        const decodedMappedColumn = decodeURIComponent(csvData[i][selectedColumn]);
        resultStaging[decodedMappedColumn] = csvResults;
        queue.push(apiData);
      } catch (error) {
        console.log('An entry has failed');
      }

      // Sends all queued data to api once there are 4 in queue
      if (queue.length >= 4) {
        // Builds out the urls to be sent to the API
        let urls = [];
        queue.forEach(entry => {
          urls.push(buildUrl(entry))
        });

        // Sends all requests at the same time
        const responses = await Promise.all(urls.map(url => fetch(url)))
        const data = await Promise.all(responses.map(response => response.json()))

        // Combines columns recieved from API with columns from csv
        data.forEach(result => {
          for (const [key,value] of Object.entries(result)) {
            if (value in resultStaging) {
              resultStaging[value] = Object.assign({}, result, resultStaging[value]);

              delete resultStaging[value][key];

              result_list.push(resultStaging[value]);
              delete resultStaging[value];
            }
          }
        });

        // Sets the frontend percentage
        setCompletePercentage(percent);

        // Resets the queue
        queue = [];
      }
    }

    // Get data from remaining entries
    // Will only run if entries from csv are not divisible by 4
    if (queue.length > 0) {
      let urls = [];
      queue.forEach(entry => {
        urls.push(buildUrl(entry))
      });

      const responses = await Promise.all(urls.map(url => fetch(url)))
      const data = await Promise.all(responses.map(response => response.json()))

      data.forEach(result => {
        for (const [key,value] of Object.entries(result)) {
          if (value in resultStaging) {
            resultStaging[value] = Object.assign({}, resultStaging[value], result);

            delete resultStaging[value][key];

            result_list.push(resultStaging[value]);
          }
        }
      });

      setCompletePercentage(percent);
    }

    // Deletes undesired columns when Clean CSV option is set to true
    const columns_to_delete = ['Research Date', 'Middle Name', 'List', 'Email 1 Validation', 'Email 1 Total AI', 'Email 2', 'Email 2 Validation', 'Email 2 Total AI', 'Personal Email Validation', 'Personal Email Total AI', 'Contact Phone 2', 'Company Phone 2', 'Contact Phone 3', 'Company Phone 3', 'Contact State Abbr', 'Contact Country', 'Contact Country (Alpha 2)', 'Contact Country (Alpha 3)', 'Contact Country - Numeric', 'Company State Abbr', 'Company Post Code', 'Company Country (Alpha 2)', 'Company Country (Alpha 3)', 'Company Country - Numeric', 'Company Description', 'Company Website Domain', 'Company Founded Date'];
    
    // Rename Columns if necessary
    const rename_index = {
      'linkedin_email': 'Linkedin Email',
      'linkedin_phone': 'Linkedin Phone',
      'best_email': 'Best Email',
      'best_phone': 'Best Phone',
    }

    for (let i = result_list.length - 1; i >= 0; i--) {
      for (let key in result_list[i]) {
        if (cleanCsv) {
          if (columns_to_delete.includes(key)) {
            delete result_list[i][key];
          }

          if (!columns_to_delete.includes(key) && rename_index.hasOwnProperty(key)) {
            result_list[i][rename_index[key]] = result_list[i][key];
            delete result_list[i][key];
          }
        } else {
          if (rename_index.hasOwnProperty(key)) {
            result_list[i][rename_index[key]] = result_list[i][key];
            delete result_list[i][key];
          }
        }
      }
    }

    if (csvSource === 'seamless') {
      // Reorganize columns
      // Stores all the keys in an array
      let col_names = Object.keys(result_list[0])

      if (col_names.includes('Best Email')) {
        col_names = moveColumn(col_names, 'Best Email', 'Email 1');
      }
      
      if (col_names.includes('Linkedin Email')) {
        col_names = moveColumn(col_names, 'Linkedin Email', 'Email 1');
      }
      
      if (col_names.includes('Best Phone')) {
        col_names = moveColumn(col_names, 'Best Phone', 'Contact Phone 1');
      }
      
      if (col_names.includes('Linkedin Phone')) {
        col_names =  moveColumn(col_names, 'Linkedin Phone', 'Contact Phone 1');
      }

      //Rebuild object with organized columns
      let final_results = result_list;
      let staging_list = [];
      for (let i = 0; i < final_results.length; i++) {
        let staging_dict = {};
        for (let column of col_names) {
          staging_dict[column] = final_results[i][column];
        }

        staging_list.push(staging_dict);
      }
      final_results = staging_list;

      // Adds results to global variable to be downloaded
      setResultData(final_results);
    } else {
      // Adds results to global variable to be downloaded
      setResultData(result_list)
    }

    setCompleteStatus(true);
  }

  function moveColumn(array, columnToMove, beforeColumn) {
    const indexToMove = array.indexOf(columnToMove);
    const indexBeforeColumn = array.indexOf(beforeColumn);

    if (indexToMove === -1 || indexBeforeColumn === -1) {
        // One or both of the elements were not found in the array
        return array;
    }
    
    array.splice(indexToMove, 1); // remove item from its current position
    array.splice(indexBeforeColumn, 0, columnToMove); // Insert columnToMove before beforeColumn

    return array;
  }

  function buildUrl(data) {
    let url = '';
    if (data.seamless === true) {
      url = `https://us-west3-foundation-production.cloudfunctions.net/enrich-csv-task-handler?selectedColumn=${data.selectedColumn}&scraperType=${data.scraperType}&seamless=${data.seamless}&seamEmail=${data.extraColumns['Email 1']}&emailScore=${data.extraColumns['Email 1 Total AI']}&seamPhone=${data.extraColumns['Contact Phone 1']}&personalEmail=${data.extraColumns['Personal Email']}&personalEmailScore=${data.extraColumns['Personal Email Total AI']}&seamThresh=${emailThreshold}`;
    } else {
      url = `https://us-west3-foundation-production.cloudfunctions.net/enrich-csv-task-handler?selectedColumn=${data.selectedColumn}&scraperType=${data.scraperType}&seamless=${data.seamless}&email=${data.emailColumn}&phone=${data.phoneColumn}`;
    }
    
    return url;
  }

  // =================================================================================
  // Event Listeners
  // =================================================================================
  const handleDownload = () => {
    let csvName = filename.replace('.csv', '-results.csv');

    const csv = Papa.unparse(resultData);
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = csvName;
    document.body.appendChild(link);
    link.click();
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (file.size > 10485760) {
      setFileErr('File size should be less than 10 MB');
    } else {
      setFilename(file.name);


    
      const reader = new FileReader();
      reader.onload = async (event) => {
        let csvData = event.target.result;

  

        // Replaces all "." in the colum names
        let split_lines = csvData.split('\n');
        const updated_header = split_lines[0].replaceAll('.', '_')
        split_lines[0] = updated_header;

        csvData = split_lines.join('\n');
        
        const jsonData = await csvtojson().fromString(csvData);

  

        if (jsonData.length > 1500) {
          setFileErr('CSV should be less than 1,500 lines');
        } else {
          setFileErr(null);
          setCsvData(jsonData);

          setColumns(Object.keys(jsonData[0]));
        }
      };

      reader.readAsText(file);
    }
  }

  const handleCsvDelete = () => {
    setCsvData(null);

    setSelectedColumn('');

    setColumns(null);
  }

  const handleFormSubmit = (event) => {
    event.preventDefault();

    if ((scraperType === 'email-phone') && (emailOption === false) && (phoneOption === false)) {
      alert("Please select an enrichment option.")
    } else {
      setSubmitted(true);

      processData();
    }
  }

  // =================================================================================
  // HTML and CSS
  // =================================================================================



  return (
    <div id="scraper-app">
      <div id="heading">
        <h1 className="scraper-h1">CSV Data Processing</h1>
      </div>
      <div id="body-section">
        <form onSubmit={handleFormSubmit}>
          <div className="form-item">
            {/* This section describes the upload button and info icon before file submission */}
            {!csvData && (
              <div className="d-flex">
                <label id="upload-csv-label" htmlFor="csv-upload">
                Upload CSV
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload} 
                  required
                  style={{ display: 'none' }}
                />
                </label>
                <div className="info-icon">
                  <img src={infoLogo} alt="" className="info-icon-icon" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} />
                  {isHovering && <div className="info-box">
                    <p className="info-text">CSV must be less than 10MB and 1,500 rows.</p>
                    <div className="transparent-box"></div>
                  </div>}
                </div>
              </div>
            )}
            {fileErr && (
              <p>{fileErr}</p>
            )}
            {csvData && (
              <div className="d-flex">
                <p>{filename}</p>
                <p className="info-icon cursor-pointer" onClick={handleCsvDelete}>&#x2715;</p>
              </div>
            )}
          </div>
          <section id="scraper-typeSelection">
            <div>
              <div className="form-item">
                <FormControl className="select-div" variant="standard">
                  <InputLabel htmlFor="scraper-select">Data Proccessing Action</InputLabel>
                  <Select id="scraper-select" value={scraperType} onChange={(event) => setScraperType(event.target.value)} required>
                    <MenuItem value="">Select a scraper</MenuItem>
                    <MenuItem value="email-phone">LI Email/Phone Enrichment</MenuItem>
                    <MenuItem value="profile-company">LI Profile + Company Scraper</MenuItem>
                    <MenuItem value="profile">LI Profile Scraper</MenuItem>
                    <MenuItem value="company">LI Company Scraper</MenuItem>
                  </Select>
                </FormControl>
              </div>
              {scraperType !== '' && (
                <div className="form-item">
                  <FormControl className="select-div" variant="standard">
                    {scraperType === 'company' && (
                      <InputLabel htmlFor="column-select">Column Containing LinkedIn Company URL</InputLabel>
                    )}
                    {scraperType !== 'company' && (
                      <InputLabel htmlFor="column-select">Column Containing LinkedIn Profile URL</InputLabel>
                    )}
                    <Select id="column-select" value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} required>
                      <MenuItem value="">Select a column</MenuItem>
                      {column_names && (
                        column_names.map((column, index) => (
                          <MenuItem key={index} value={column}>{column}</MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </div>
              )}
              {scraperType === 'email-phone' && (
                <div className="form-item">
                  <InputLabel>Enrichment Options</InputLabel>
                  <div className="enrichment-options">
                    <FormControlLabel className="checkbox" control={<Checkbox />} label="Email" checked={emailOption} onChange={(event) => setEmailOption(event.target.checked)} />
                    <FormControlLabel className="checkbox" control={<Checkbox />} label="Phone" checked={phoneOption} onChange={(event) => setPhoneOption(event.target.checked)} />
                  </div>

                  <div className="form-item">
                    <FormControl className="select-div" variant="standard">
                      <InputLabel htmlFor="source-select">CSV Source</InputLabel>
                      <Select id="source-select" value={csvSource} onChange={(event) => setCsvSource(event.target.value)}>
                        <MenuItem value="">Select Source</MenuItem>
                        <MenuItem value="seamless">Seamless</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </div>

                  {csvSource === 'seamless' && (
                    <div className="vertical-list m-space">
                      <div className="digit-input-form">
                        <input type="number" className="digit-input" value={emailThreshold} onChange={(event) => setEmailThreshold(event.target.value)} />
                        <label>Seamless Email Threshold</label>
                      </div>
                      <div className="d-flex">
                        <FormControlLabel className="checkbox-w-info" control={<Checkbox />} label="Cleanup Seamless CSV" checked={cleanCsv} onChange={(event) => setCleanCsv(event.target.checked)} />
                        <div className="info-icon-bottom">
                          <img src={infoLogo} alt="" className="info-icon-icon" onMouseEnter={() => setBottomInfo(true)} onMouseLeave={() => setBottomInfo(false)} />
                          {bottomInfo && <div className="info-box">
                            <p className="info-text">This cleanup only deletes columns we deemed unnecessary and and doesn't do anything with the data in the rows of the CSV.</p>
                            <div className="transparent-box"></div>
                          </div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {csvSource === 'other' && (
                    <div>
                      {emailOption === true && (
                        <div className="form-item">
                          <FormControl className="select-div" variant="standard">
                            <InputLabel htmlFor="email-column">Column Containing Emails</InputLabel>
                            <Select id="email-column" value={emailColumn} onChange={(event) => setEmailColumn(event.target.value)}>
                              <MenuItem value="">Select a column</MenuItem>
                              {column_names && (
                                column_names.map((column, index) => (
                                  <MenuItem key={index} value={column}>{column}</MenuItem>
                                ))
                              )}
                            </Select>
                          </FormControl>
                        </div>
                      )}
                      {phoneOption === true && (
                        <div className="form-item">
                          <FormControl className="select-div" variant="standard">
                            <InputLabel htmlFor="phone-column">Column Containing Phone Numbers</InputLabel>
                            <Select id="phone-column" value={phoneColumn} onChange={(event) => setPhoneColumn(event.target.value)}>
                              <MenuItem value="">Select a column</MenuItem>
                                {column_names && (
                                  column_names.map((column, index) => (
                                    <MenuItem key={index} value={column}>{column}</MenuItem>
                                  ))
                                )}
                            </Select>
                          </FormControl>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {csvData && (
              scraperType !== '' && (
                <div className="estimates">
                  <p>{currentCredits} <span>Credits Available</span></p>
                  <p>{estimatedCost} <span>Projected Credits to be Used</span></p>
                </div>
              )
            )}
          </section>
          {costErr && (
            <p>{costErr}</p>
          )}
          {!submitted && (
            csvData && (
              !costErr && (
                <div className="btn-div">
                  <button className="submit-btn" type="submit">Process Data</button>
                </div>
              )
            )
          )}
          {submitted && (
            <div>
              {completePercentage < 100 && (
                <InputLabel>Processing Data...</InputLabel>
              )}
              {completePercentage >= 100 && (
                <InputLabel>Complete</InputLabel>
              )}
              <div id="progress-bar">
                <p id="percent">{completePercentage}%</p>
                <div 
                  id="percent-bar"
                  style={{ width: `${completePercentage}%` }}
                >
                </div>
              </div>
              {completePercentage < 100 && (
                <p className='warning'>*Do not close browser window while data is processing.</p>
              )}

              {completeStatus && (
                <input type="button" id="download-btn" className="submit-btn" onClick={handleDownload} value="Download CSV" />
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}